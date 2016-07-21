$(() => {
  $(window).resize(checkSize);
  checkSize();

  function checkSize() {
    if (document.body.clientWidth <= 900) {
      $('.tripleSection').removeClass("column");
      $('.freeLogo').removeClass("invisible");
    } else {
      $('.tripleSection').addClass("column");
      $('.freeLogo').addClass("invisible");
    }
  }
});
