let isFeedbackMode = false;
let feedbackForm;
let elementInfoInput;
let currentX, currentY;

function loadWebsite() {
    const urlInput = document.getElementById('website-url');
    let url = urlInput.value.trim();
    
    if (!url) {
        alert('Vänligen ange en URL');
        return;
    }

    // Lägg till https:// om det saknas
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    try {
        new URL(url); // Validera URL
        
        // Sätt iframe src och visa feedback container
        document.getElementById('target-website').src = url;
        document.getElementById('url-input-container').classList.add('hidden');
        document.getElementById('feedback-container').classList.remove('hidden');
        
    } catch (e) {
        alert('Ogiltig URL. Vänligen ange en giltig webbadress.');
    }
}

function showLoading(message = 'Laddar...') {
    const loading = document.createElement('div');
    loading.className = 'loading-overlay';
    loading.id = 'loadingOverlay';
    loading.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
        </div>
    `;
    document.body.appendChild(loading);
}

function hideLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.remove();
    }
}

function toggleFeedbackMode(enabled) {
    isFeedbackMode = enabled;
    
    if (enabled) {
        // Visa feedback-formuläret direkt
        feedbackForm.classList.remove('hidden');
        
        // Rensa eventuellt tidigare innehåll
        document.getElementById('message').value = '';
        const previewContainer = document.getElementById('preview-container');
        previewContainer.innerHTML = '';
        
        // Skapa overlay för klick och preview
        const overlay = document.createElement('div');
        overlay.id = 'feedback-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.zIndex = '1000';
        overlay.style.cursor = 'crosshair';
        
        // Lägg till preview-rutan
        const preview = document.createElement('div');
        preview.className = 'screenshot-preview';
        preview.style.display = 'none';
        overlay.appendChild(preview);
        
        // Hantera musrörelse för preview
        overlay.addEventListener('mousemove', (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            preview.style.display = 'block';
            preview.style.left = x + 'px';
            preview.style.top = y + 'px';
        });
        
        overlay.addEventListener('mouseleave', () => {
            preview.style.display = 'none';
        });
        
        overlay.addEventListener('click', handleFeedbackClick);
        document.querySelector('.iframe-container').appendChild(overlay);
    } else {
        // Dölj feedback-formuläret och ta bort overlay
        feedbackForm.classList.add('hidden');
        const overlay = document.getElementById('feedback-overlay');
        if (overlay) overlay.remove();
    }
}

async function handleFeedbackClick(e) {
    if (!isFeedbackMode) return;
    
    const rect = e.target.getBoundingClientRect();
    currentX = e.clientX - rect.left;
    currentY = e.clientY - rect.top;

    // Skapa elementinfo
    const elementInfo = {
        x: currentX,
        y: currentY,
        timestamp: new Date().toISOString(),
        url: document.getElementById('target-website').src,
        elementDescription: ''
    };

    try {
        showLoading('Tar skärmdump...');
        console.log('Requesting screenshot...');
        const response = await fetch('/api/screenshot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: elementInfo.url,
                x: currentX,
                y: currentY
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Server error: ${errorData.details || 'Unknown error'}`);
        }
        
        const data = await response.json();
        elementInfo.screenshot = data.screenshot;
        console.log('Screenshot received successfully');
    } catch (error) {
        console.error('Screenshot error:', error);
    } finally {
        hideLoading();
    }

    updatePreview(elementInfo);
    feedbackForm.classList.remove('hidden');
    elementInfoInput.value = JSON.stringify(elementInfo);
}

document.addEventListener('DOMContentLoaded', function() {
    feedbackForm = document.getElementById('feedback-form');
    elementInfoInput = document.getElementById('elementInfo');
    
    const feedbackToggle = document.getElementById('feedbackToggle');
    feedbackToggle.addEventListener('change', (e) => toggleFeedbackMode(e.target.checked));
    
    // Aktivera feedback-läget direkt
    toggleFeedbackMode(true);
    
    document.getElementById('feedbackForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitButton = this.querySelector('button[type="submit"]');
        submitButton.classList.add('button-loading');
        
        const formData = {
            elementInfo: JSON.parse(elementInfoInput.value),
            message: document.getElementById('message').value
        };
        
        try {
            showLoading('Skickar feedback...');
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                hideLoading();
                alert('Tack för din feedback!');
                feedbackForm.classList.add('hidden');
                document.getElementById('message').value = '';
            } else {
                hideLoading();
                alert('Ett fel uppstod. Försök igen senare.');
            }
        } catch (error) {
            console.error('Error:', error);
            hideLoading();
            alert('Ett fel uppstod. Försök igen senare.');
        } finally {
            submitButton.classList.remove('button-loading');
        }
    });

    const iframe = document.getElementById('target-website');
    iframe.addEventListener('load', function() {
        console.log('Iframe loaded');
    });

    const urlInput = document.getElementById('website-url');
    urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadWebsite();
        }
    });
});

function updatePreview(elementInfo) {
    const preview = document.createElement('div');
    preview.innerHTML = `
        <div class="preview-container">
            <div class="preview-header">Valt element</div>
            <div class="preview-content">
                <div class="description-input">
                    <input type="text" 
                        id="descriptionInput" 
                        value="${elementInfo.elementDescription}"
                        placeholder="Beskriv objektet..."
                        onchange="updateDescription(this.value)"
                    >
                </div>
                ${elementInfo.screenshot ? `
                    <div class="screenshot-container">
                        <img src="${elementInfo.screenshot}" alt="Valt område">
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    const previewContainer = document.getElementById('preview-container');
    previewContainer.innerHTML = '';
    previewContainer.appendChild(preview);
}

// Lägg till denna funktion för att hantera beskrivningsändringar
function updateDescription(newDescription) {
    const elementInfo = JSON.parse(elementInfoInput.value);
    elementInfo.elementDescription = newDescription;
    elementInfoInput.value = JSON.stringify(elementInfo);
} 