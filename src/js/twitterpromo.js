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
    clearResult();
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
        switch(xhr.responseText) {
          case "too_new":
            result.html("Your Twitter account seems a little too new 😕<br>Please tweet on a legit account.");
            result.css("color", "red");
            break;
          case "account_doesn't_exist":
            result.html("The provided Twitter username doesn't exist.<br>Please make sure that you typed your Twitter username properly.");
            result.css("color", "red");
            break;
          case "already_used_twitter":
            result.html("This Twitter username has already been used to promote RandomAPI. Please be good 😕");
            result.css("color", "red");
            break;
          case "no_tweet_found":
          default:
            result.html("Sorry, we couldn't find your tweet. Please make sure that you typed<br>your Twitter username properly and that you've tweeted within the last hour.");
            result.css("color", "red");
            break;
        };
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
