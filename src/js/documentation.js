$(() => {
  hljs.initHighlightingOnLoad();
  $('a[href*=\\#]:not([href=\\#])').click(function() {
    if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
      let target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) +']');
      if (target.length) {
        $('html,body').animate({
          scrollTop: target.offset().top - 75
        }, 500, () => {
           window.location.hash = this.hash;
        });
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

    // Yes, I actually put the effort into making the timestamp live
    updateTimestamp();
    setInterval(updateTimestamp, 1000);

    function updateTimestamp() {
      $('.timestamp').html(`timestamp(); <span class="hljs-comment">//${Math.floor(new Date().getTime()/1000)}</span>`);
    }
  }

  // ===== Scroll to Top ====
  $(window).scroll(function() {
      if ($(this).scrollTop() >= 50) {        // If page is scrolled more than 50px
          $('#return-to-top').fadeIn(200);    // Fade in the arrow
      } else {
          $('#return-to-top').fadeOut(200);   // Else fade out the arrow
      }
  });
  $('#return-to-top').click(function() {      // When arrow is clicked
      $('body,html').animate({
          scrollTop : 0                       // Scroll to top of body
      }, 500);
  });
});
