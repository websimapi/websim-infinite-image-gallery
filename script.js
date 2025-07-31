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
            img.style.left = Math.random() * (window.innerWidth - 300) + 'px';
            img.style.top = Math.random() * (window.innerHeight - 200) + 'px';
            img.style.transform = `rotate(${Math.random() * 20 - 10}deg)`;
            img.title = `By ${comment.author.display_name}`;
            
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
    if (!prompt) {
        alert('Please enter a prompt');
        return;
    }
    
    try {
        const result = await websim.imageGen({ prompt });
        const generatedImages = [result.url];
        
        window.generatedImages = generatedImages;
        alert('Image generated! Ready to submit.');
    } catch (error) {
        alert('Error generating image: ' + error.message);
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