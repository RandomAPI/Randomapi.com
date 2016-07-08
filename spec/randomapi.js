const fs      = require('fs');
const async   = require('async');
const expect  = require('chai').expect;
const request = require('supertest');

const cookie     = require('cookie');
const pad        = require('../utils').pad;
const logger     = require('../utils').logger;
const sessionDB  = require('../utils').redis;
const server     = require('../app').server;
const app        = require('../app').app;

describe('RandomAPI', () => {

  // Start up Express server
  before(done => {
    const db = require('../models/db').init(() => {

      require('../sockets.js');

      server.listen(app.get('port'));
      server.on('error', error => {
        let bind = app.get('port');
        switch (error.code) {
          case 'EACCES':
            logger(`[server]: ${bind} requires elevated privileges`);
            process.exit(1);
            break;
          case 'EADDRINUSE':
            logger(`[server]: ${bind} is already in use`);
            process.exit(1);
            break;
          default:
            throw error;
        }
      });

      process.title = "RandomAPI_Server";

      server.on('listening', () => {
        let addr = server.address();
        let bind = typeof addr === 'string'
          ? 'pipe ' + addr
          : 'port ' + addr.port;
        logger(`[server]: Listening on ${bind}`);
        done();
      });
    });
  });

  describe('Website', () => {
    describe('Basic Pages', () => {
      it('should return 302 when visiting home page (/) on first visit', done => {
        request(server).get('/').expect(302)
        .end((err, res) => {
          if (err) return done(err);
          done();
        });
      });

      let pages = ['', 'pricing', 'documentation', 'login', 'register'];

      pages.forEach(page => {
        it(`should return 200 when visiting ${page === '' ? 'home' : page} page (/${page}) after initial visit`, done => {
          request(server).get(`/${page}`).expect(200)
          .end((err, res) => {
            if (err) return done(err);
            done();
          });
        });
      });
    });

    describe('Authentication Required Pages', () => {
      let pages = [
        'new/api', 'new/list', 'edit/api', 'edit/list', 'view/api', 'view/list',
        'new/api/blah1', 'new/list/blah1', 'edit/api/blah1', 'edit/list/blah1', 'view/api/blah1', 'view/list/blah1',
        'delete/api/blah1', 'delete/list/blah1',
        'settings', 'settings/subscription', 'upgrade'
      ];

      pages.forEach(page => {
        it(`should redirect to home page when visiting (/${page})`, done => {
          request(server).get(`/${page}`)
          .end((err, res) => {
            expect(res.header['location']).to.equal('/');
            done();
          });
        });
      });
    });
  });
});
