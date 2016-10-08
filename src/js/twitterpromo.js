$(() => {
  let input  = $("#twitterhandle");
  let button = $("#twittersubmit");
  let result = $("#result");

  input.keypress(e => {
    clearResult();
    if (e.which == 13) {
      verify();
      return false;
    }
  });

  button.click(e => {
    verify();
  });

  function verify() {
    if (input.val() === '') return;

    disable();

    let username = input.val();
    $.post('twitterpromo', {username})
      .done(data => {
        result.html("Thanks for the tweet " + username + "!<br>Your account has been upgraded to the Standard tier free of charge!<br><br>Thanks for using RandomAPI!");
        result.css("color", "green");
        $("#verify").css('display', 'none');
        $("#thanks").css('display', 'block');
      })
      .fail((xhr, status, error) => {
        result.html("Sorry, we couldn't find your tweet. Please make sure that you typed<br>your Twitter username properly and that you've tweeted within the last hour.");
        result.css("color", "red");
        enable();
      });
  }

  function disable() {
    input.prop('readonly', true);
    input.prop('disabled', true);
  }

  function enable() {
    input.prop('readonly', false);
    input.prop('disabled', false);
    input.select();
    input.focus();
  }

  function clearResult() {
    result.html('');
  }
});
