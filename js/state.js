// ===== ESTADO GLOBAL =====
// Estado compartido mutable por todas las secciones (home, proyecto, menu,
// router). Cada lectura/escritura de estas variables pasa por `state.*`.
export const state = {
    appData: null,
    coloresData: null,
    currentMode: 'portfolio',
    currentProject: null,
    currentView: null, // 'home' | 'project'
};
