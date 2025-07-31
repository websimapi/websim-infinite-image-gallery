import { marked } from 'marked';
import DOMPurify from 'dompurify';

class ImageGallery {
    constructor() {
        this.images = [];
        this.imageElements = [];
        this.loadedComments = new Set();
        this.init();
    }

    async init() {
        await this.loadComments();
        this.setupInfiniteScroll();
        this.setupRealTimeUpdates();
    }

    async loadComments() {
        const project = await window.websim.getCurrentProject();
        const response = await fetch(`/api/v1/projects/${project.id}/comments?only_tips=true`);
        const data = await response.json();
        
        const newImages = [];
        
        for (const commentData of data.comments.data) {
            const comment = commentData.comment;
            
            // Check if it's a tip comment with at least 10 credits
            if (comment.card_data?.type === 'tip_comment' && 
                comment.card_data.credits_spent >= 10 &&
                !this.loadedComments.has(comment.id)) {
                
                const images = this.extractImagesFromComment(comment.raw_content);
                images.forEach(imgUrl => {
                    newImages.push({
                        url: imgUrl,
                        comment: comment
                    });
                });
                
                this.loadedComments.add(comment.id);
            }
        }
        
        this.images.push(...newImages);
        this.renderImages(newImages);
        this.updateStats();
    }

    extractImagesFromComment(markdown) {
        const images = [];
        const imageRegex = /!\[.*?\]\((.*?)\)/g;
        let match;
        
        while ((match = imageRegex.exec(markdown)) !== null) {
            images.push(match[1]);
        }
        
        return images;
    }

    renderImages(imageData) {
        const container = document.getElementById('backgroundContainer');
        
        imageData.forEach(({ url, comment }) => {
            const img = document.createElement('img');
            img.src = url;
            img.className = 'background-image';
            
            // Calculate random position ensuring image stays within viewport
            const maxX = window.innerWidth - Math.min(400, window.innerWidth * 0.8);
            const maxY = window.innerHeight - Math.min(300, window.innerHeight * 0.8);
            
            img.style.left = Math.random() * maxX + 'px';
            img.style.top = Math.random() * maxY + 'px';
            img.style.transform = `rotate(${Math.random() * 20 - 10}deg) scale(${0.8 + Math.random() * 0.4})`;
            img.title = `By ${comment.author.display_name}`;
            
            // Ensure image loads properly before positioning
            img.onload = () => {
                // Adjust position if image overflows
                const rect = img.getBoundingClientRect();
                if (rect.right > window.innerWidth) {
                    img.style.left = (window.innerWidth - rect.width - 20) + 'px';
                }
                if (rect.bottom > window.innerHeight) {
                    img.style.top = (window.innerHeight - rect.height - 20) + 'px';
                }
            };
            
            img.addEventListener('click', () => {
                this.showImageDetail(comment);
            });
            
            container.appendChild(img);
            this.imageElements.push(img);
        });
    }

    setupInfiniteScroll() {
        setInterval(() => {
            this.loadComments();
        }, 5000);
    }

    setupRealTimeUpdates() {
        window.websim.addEventListener('comment:created', async (data) => {
            const comment = data.comment;
            
            if (comment.card_data?.type === 'tip_comment' && 
                comment.card_data.credits_spent >= 10) {
                
                const images = this.extractImagesFromComment(comment.raw_content);
                const newImages = images.map(url => ({ url, comment }));
                
                this.images.push(...newImages);
                this.renderImages(newImages);
                this.updateStats();
            }
        });
    }

    updateStats() {
        const imageCountElement = document.getElementById('imageCount');
        if (imageCountElement) {
            imageCountElement.textContent = this.imageElements.length;
        }
    }

    showImageDetail(comment) {
        alert(`Image by ${comment.author.display_name}\n\n${comment.raw_content}`);
    }
}

function openCommentModal() {
    document.getElementById('commentModal').style.display = 'block';
}

function closeCommentModal() {
    document.getElementById('commentModal').style.display = 'none';
}

function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.style.display = 'none');
    
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).style.display = 'block';
}

async function generateImage() {
    const prompt = document.getElementById('promptInput').value;
    const generateBtn = document.querySelector('.generate-btn');
    const previewContainer = document.getElementById('generatePreview');
    
    if (!prompt) {
        alert('Please enter a prompt');
        return;
    }
    
    try {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner"></span>Generating...';
        previewContainer.innerHTML = '';
        
        const result = await websim.imageGen({ prompt });
        
        // Create preview
        const img = document.createElement('img');
        img.src = result.url;
        img.className = 'preview-image';
        img.style.width = '200px';
        img.style.height = '200px';
        previewContainer.appendChild(img);
        
        window.generatedImages = [result.url];
        
    } catch (error) {
        alert('Error generating image: ' + error.message);
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '✨ Generate Image';
    }
}

async function submitComment() {
    const commentInput = document.getElementById('commentInput');
    const content = commentInput.value || 'Great work! Here are some images';
    
    let images = [];
    
    // Check if we have generated images
    if (window.generatedImages && window.generatedImages.length > 0) {
        images = [...window.generatedImages];
    } else {
        // Check for uploaded files
        const fileInput = document.getElementById('imageInput');
        if (fileInput.files.length === 0) {
            alert('Please select images or generate an AI image');
            return;
        }
        
        const files = Array.from(fileInput.files);
        for (const file of files.slice(0, 4)) {
            const url = await window.websim.upload(file);
            images.push(url);
        }
    }
    
    const result = await window.websim.postComment({
        content: content,
        images: images
    });
    
    if (result.error) {
        alert('Error: ' + result.error);
        return;
    }
    
    closeCommentModal();
    
    // Reset form
    document.getElementById('imageForm')?.reset();
    document.getElementById('imageInput').value = '';
    document.getElementById('promptInput').value = '';
    document.getElementById('commentInput').value = '';
    window.generatedImages = null;
}

// Handle preview for uploaded images
document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    const uploadPreview = document.getElementById('uploadPreview');
    
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            uploadPreview.innerHTML = '';
            const files = Array.from(e.target.files);
            
            if (files.length > 4) {
                alert('Maximum 4 images allowed');
                e.target.value = '';
                return;
            }
            
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = 'preview-image';
                    uploadPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }
});

// Update the file handling
document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 4) {
                alert('Maximum 4 images allowed');
                e.target.value = '';
            }
        });
    }
});

// Attach functions to global window object
window.openCommentModal = openCommentModal;
window.closeCommentModal = closeCommentModal;
window.switchTab = switchTab;
window.generateImage = generateImage;
window.submitComment = submitComment;

window.onclick = function(event) {
    const modal = document.getElementById('commentModal');
    if (event.target === modal) {
        closeCommentModal();
    }
}

const gallery = new ImageGallery();