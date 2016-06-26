$(() => {
  hljs.initHighlightingOnLoad();
  $('a[href*=\\#]:not([href=\\#])').click(() => {
    if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
      let target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) +']');
      if (target.length) {
        $('html,body').animate({
          scrollTop: target.offset().top - 25
        }, 500);
        return false;
      }
    }
  });

  $(window).scroll(scrollHighlight);
  scrollHighlight();

  function scrollHighlight() {
    let found = false;
    let namedHrefs = $('a').filter((key, item) => $(item).attr('name') !== undefined);

    namedHrefs.each((key, val) => {
      if (($(val).offset().top - $(window).scrollTop() >= 0 && !found) || (!found && namedHrefs.length-1 === key)) {
        found = $(val);
      }
    });

    $('a').each((item, val) => {
      if ($(val).attr('href') === "documentation#" + found.attr('name')) {
        $(val).addClass('docGreen');
      } else {
        $(val).removeClass('docGreen');
      }
    });
  }
});
