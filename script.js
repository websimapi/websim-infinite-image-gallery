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
        document.getElementById('imageCount').textContent = this.imageElements.length;
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

document.getElementById('imageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('imageInput');
    const commentInput = document.getElementById('commentInput');
    
    if (fileInput.files.length === 0) {
        alert('Please select at least one image');
        return;
    }
    
    const images = [];
    const files = Array.from(fileInput.files);
    for (const file of files.slice(0, 4)) {
        const url = await window.websim.upload(file);
        images.push(url);
    }
    
    const content = commentInput.value || 'Great work! Here are some images';
    
    await window.websim.postComment({
        content: content,
        images: images
    });
    
    closeCommentModal();
    document.getElementById('imageForm').reset();
});

const gallery = new ImageGallery();

window.onclick = function(event) {
    const modal = document.getElementById('commentModal');
    if (event.target === modal) {
        closeCommentModal();
    }
}

// Attach modal functions to global window object
window.openCommentModal = openCommentModal;
window.closeCommentModal = closeCommentModal;