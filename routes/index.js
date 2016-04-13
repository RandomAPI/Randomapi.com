var express = require('express');
var crypto = require('crypto');
var router = express.Router();
var multer = require('multer');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/')
  },
  filename: function (req, file, cb) {
    console.log(file);
    crypto.pseudoRandomBytes(16, function (err, raw) {
      cb(null, raw.toString('hex') + Date.now() + '.' + file.originalname.match(/.*\.(.*)/)[1]);
    });
  }
});
var upload = multer({ storage: storage });

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/', upload.any(), function(req, res){
    console.log(req.body) // form fields
    console.log(req.files) // form files
    res.status(204).end()
});

module.exports = router;
