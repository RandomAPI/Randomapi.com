module.exports = {
  adduser() {
    let userinfo = {
      username: 'keith',
      password: 'hashed',
      apikey: 'asdf'
    };

    db.query('INSERT INTO `User` SET ?', userinfo, (err, result) => {
      console.log(err, result);
    });
  }
};
