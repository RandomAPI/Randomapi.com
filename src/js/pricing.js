function selectPlan() {
  $.get('register', () => {
    window.location.href = 'register/guest';
  });
}
