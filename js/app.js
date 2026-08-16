// Bookstore Manager - Shared Application Logic
// ============================================

/**
 * Navigation utility for managing page transitions
 */
const Navigation = {
    goToLogin: () => window.location.href = 'index.html',
    goToInventory: () => window.location.href = 'inventory.html',
    goToServices: () => window.location.href = 'services.html',
    goToProfile: () => console.log('Profile page not yet implemented'),
};

/**
 * Storage utility for persisting application data
 */
const Storage = {
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('Storage quota exceeded or not available', e);
        }
    },
    
    getItem: (key) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.warn('Failed to retrieve item from storage', e);
            return null;
        }
    },
    
    removeItem: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('Failed to remove item from storage', e);
        }
    },
    
    clear: () => {
        try {
            localStorage.clear();
        } catch (e) {
            console.warn('Failed to clear storage', e);
        }
    }
};

/**
 * User authentication state management
 */
const Auth = {
    isAuthenticated: () => {
        return Storage.getItem('isLoggedIn') === true;
    },
    
    login: (email, password) => {
        // Simple demo - in production, validate against backend
        if (email && password) {
            Storage.setItem('isLoggedIn', true);
            Storage.setItem('userEmail', email);
            return true;
        }
        return false;
    },
    
    logout: () => {
        Storage.clear();
        Navigation.goToLogin();
    },
    
    getCurrentUser: () => {
        return Storage.getItem('userEmail') || 'Guest User';
    }
};

/**
 * Inventory management utilities
 */
const Inventory = {
    addProduct: (product) => {
        const products = Storage.getItem('products') || [];
        products.push({
            ...product,
            id: Date.now(),
            createdAt: new Date().toISOString()
        });
        Storage.setItem('products', products);
        return products;
    },
    
    getProducts: () => {
        return Storage.getItem('products') || [];
    },
    
    deleteProduct: (productId) => {
        const products = Storage.getItem('products') || [];
        const filtered = products.filter(p => p.id !== productId);
        Storage.setItem('products', filtered);
        return filtered;
    },
    
    updateProduct: (productId, updates) => {
        const products = Storage.getItem('products') || [];
        const updated = products.map(p => 
            p.id === productId ? { ...p, ...updates } : p
        );
        Storage.setItem('products', updated);
        return updated;
    }
};

/**
 * Services management utilities
 */
const Services = {
    getServices: () => {
        return Storage.getItem('services') || [
            { id: 1, name: 'Impresión', price: 0.10 },
            { id: 2, name: 'Encuadernación', price: 2.50 },
            { id: 3, name: 'Escaneo', price: 0.25 }
        ];
    },
    
    addService: (service) => {
        const services = Services.getServices();
        services.push({
            ...service,
            id: Date.now()
        });
        Storage.setItem('services', services);
        return services;
    }
};

/**
 * UI utility functions
 */
const UI = {
    showNotification: (message, type = 'info') => {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // In production, implement toast notification
    },
    
    showError: (error) => {
        UI.showNotification(error, 'error');
    },
    
    showSuccess: (message) => {
        UI.showNotification(message, 'success');
    }
};

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication on protected pages
    const protectedPages = ['inventory.html', 'services.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage) && !Auth.isAuthenticated()) {
        Navigation.goToLogin();
    }
});

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Navigation, Storage, Auth, Inventory, Services, UI };
}
