function selectPlan() {
  $.get('register', () => {
    window.location.replace('register/guest');
  });
}
