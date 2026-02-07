document.addEventListener('DOMContentLoaded', () => {
    // Chat toggle functionality
    const toggleBtn = document.getElementById('toggleChat');
    const body = document.body;

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            body.classList.toggle('chat-open');

            if (body.classList.contains('chat-open')) {
                toggleBtn.style.transform = 'rotate(180deg)';
            } else {
                toggleBtn.style.transform = 'rotate(0deg)';
            }
        });
    }

    // Carousel functionality
    const carousels = document.querySelectorAll('.carousel');

    carousels.forEach(carousel => {
        const track = carousel.querySelector('.carousel-track');
        const prevBtn = carousel.querySelector('.prev');
        const nextBtn = carousel.querySelector('.next');
        const cards = Array.from(track.querySelectorAll('.card'));

        if (cards.length === 0) return;

        // Clone cards at beginning and end for infinite effect
        cards.forEach(card => {
            const cloneEnd = card.cloneNode(true);
            const cloneStart = card.cloneNode(true);
            track.appendChild(cloneEnd);
            track.insertBefore(cloneStart, track.firstChild);
        });

        const cardWidth = cards[0].offsetWidth + 20; // card width + gap
        const totalOriginalWidth = cardWidth * cards.length;

        // Position at the start of original cards (after prepended clones)
        track.scrollLeft = totalOriginalWidth;

        let isScrolling = false;

        // Handle infinite scroll
        const checkBounds = () => {
            if (isScrolling) return;

            const maxScroll = track.scrollWidth - track.clientWidth;

            if (track.scrollLeft <= cardWidth) {
                isScrolling = true;
                track.style.scrollBehavior = 'auto';
                track.scrollLeft = totalOriginalWidth;
                track.style.scrollBehavior = 'smooth';
                setTimeout(() => { isScrolling = false; }, 50);
            } else if (track.scrollLeft >= maxScroll - cardWidth) {
                isScrolling = true;
                track.style.scrollBehavior = 'auto';
                track.scrollLeft = totalOriginalWidth;
                track.style.scrollBehavior = 'smooth';
                setTimeout(() => { isScrolling = false; }, 50);
            }
        };

        track.addEventListener('scrollend', checkBounds);

        // Arrow click handlers - in RTL layout, visual "next" (left arrow) scrolls right
        nextBtn.addEventListener('click', () => {
            track.scrollBy({ left: cardWidth, behavior: 'smooth' });
        });

        prevBtn.addEventListener('click', () => {
            track.scrollBy({ left: -cardWidth, behavior: 'smooth' });
        });
    });
});
