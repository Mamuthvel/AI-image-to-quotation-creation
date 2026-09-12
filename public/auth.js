/* Shared authentication utilities */
const auth = {
  setUser(username, role) {
    localStorage.setItem('limras_user', JSON.stringify({ username, role, loginTime: Date.now() }));
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('limras_user'));
    } catch {
      return null;
    }
  },

  logout() {
    localStorage.removeItem('limras_user');
  },

  isLoggedIn() {
    return this.getUser() != null;
  },

  isAdmin() {
    return this.getUser()?.role === 'admin';
  },

  isStaff() {
    return this.getUser()?.role === 'staff';
  },

  checkAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },

  canExport() {
    return this.isAdmin();
  },

  canImport() {
    return this.isAdmin();
  },

  getUsername() {
    return this.getUser()?.username || '';
  },

  getRole() {
    return this.getUser()?.role || '';
  },
};
