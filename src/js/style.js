$(() => {
  $(window).resize(checkSize);
  checkSize();

  function checkSize() {
    if (document.body.clientWidth <= 900) {
      $('.tripleSection').removeClass("column");
      $('.freeLogo').removeClass("invisible");
      $('#mobileSubNavMenu').css('cursor', 'pointer')
      $('#mobileSubNav').removeClass("invisible");
      $('#mobileSubNavMenu').on('click', () => mobileDropDown());
      $("#mobileSubNavArrow").addClass('arrow-down')
      $('.ten.columns').css('width', '100%');
    } else {
      $('.tripleSection').addClass("column");
      $('.freeLogo').addClass("invisible");
      $('#mobileSubNavMenu').css('cursor', '')
      $('#mobileSubNav').addClass("invisible");
      $('#mobileSubNavMenu').unbind('click');
      $("#mobileSubNavArrow").removeClass('arrow-down');
      $('.ten.columns').css('width', '82.6666666667%');
    }
  }

  // Close the dropdown menu if the user clicks outside of it
  window.onclick = function(event) {
    if (!event.target.matches('#mobileSubNavMenu')) {

      var dropdowns = document.getElementsByClassName("dropdown-content");
      var i;
      for (i = 0; i < dropdowns.length; i++) {
        var openDropdown = dropdowns[i];
        $('#dropdown').removeClass("show");
      }
    }
  }
});

/* When the user clicks on the button,
toggle between hiding and showing the dropdown content */

function mobileDropDown() {
  $('#dropdown').addClass("show");
}
