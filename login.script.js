document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('login-error');
    const loginButton = loginForm.querySelector('.btn-ripple');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.style.display = 'none';

        const formData = new URLSearchParams();
        formData.append('username', loginForm.username.value);
        formData.append('password', loginForm.password.value);

        try {
            const response = await fetch('api/login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                window.location.href = 'index.html';
            } else {
                errorMessage.textContent = result.message || 'An unknown error occurred.';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            console.error('Login Error:', error);
            errorMessage.textContent = 'A connection error occurred. Please try again.';
            errorMessage.style.display = 'block';
        }
    });

    // --- Ripple Effect Logic ---
    loginButton.addEventListener('click', function(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        this.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});
