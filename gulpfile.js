const gulp    = require('gulp');
const mocha   = require('gulp-mocha');
const uglify  = require('gulp-uglifyjs');
const concat  = require('gulp-concat');
const exit    = require('gulp-exit');
const ejsmin  = require('gulp-ejsmin');
const babel   = require('gulp-babel');
const gutil   = require('gulp-util');
const through = require('through2')

gulp.task('minify-ejs-pages', () => {
  // Save the pre tag contents
  let preLocs = [];

  return gulp.src(['views/pages/*.ejs', 'views/pages/**/*.ejs'])
    .pipe(through.obj((chunk, enc, cb) => {
      let contents = chunk.contents.toString('utf8');
      let preMatches = contents.match(/<pre>?((?:.|\n)*?)<\/pre>/g);

      if (preMatches) {
        preMatches.forEach(match => {
          preLocs.push(match);
          contents = contents.replace(match, 'PRE_MATCH_' + (preLocs.length-1));
        });
        chunk.contents = new Buffer(contents, 'utf8');
      }

      cb(null, chunk)
    }))
    .pipe(ejsmin())
    .pipe(through.obj((chunk, enc, cb) => {
      let contents = chunk.contents.toString('utf8');
      let search = new RegExp(/PRE_MATCH_(\d+)/g);
      let match  = search.exec(contents);

      while (match != null) {
        contents = contents.replace('PRE_MATCH_' + match[1], preLocs[match[1]]);
        match = search.exec(contents);
      }

      chunk.contents = new Buffer(contents, 'utf8');
      cb(null, chunk)
    }))
    .pipe(gulp.dest('.viewsMin/pages'))
});

gulp.task('minify-ejs-snippets', () => {
  return gulp.src('views/snippets/*.ejs')
    .pipe(ejsmin())
    .pipe(gulp.dest('.viewsMin/snippets'))
});

gulp.task('testEnv', () => {
    return process.env.spec = true;
});

gulp.task('specnyan', ['default', 'testEnv'], () => {
  return gulp.src('spec/randomapi.js', {read: false})
    .pipe(mocha({require: ['mocha-clean'], reporter: 'nyan'}))
    .pipe(exit());
});

gulp.task('spec', ['default', 'testEnv'], () => {
  return gulp.src('spec/randomapi.js', {read: false})
    .pipe(mocha({require: ['mocha-clean'], reporter: 'spec'}))
    .pipe(exit());
});

gulp.task('es6toes5', () => {
  return gulp.src('src/js/*.js')
    .pipe(babel({
      presets: ["es2015-without-strict"]
    }).on('error', () => process.exit(1)))
    .pipe(gulp.dest('public/js'))
});

gulp.task('default', ['minify-ejs-pages', 'minify-ejs-snippets', 'es6toes5']);
