var tape = require('tape')
var rest = require('../')
var foreign = require('../foreign')
var levelup = require('level')
var rimraf = require('rimraf')
var path = require('path')
var fs = require('fs')
var async = require('async')
var through = require('through2')
var concat = require('concat-stream')

var fixtures = {
  db: path.resolve(process.cwd(), 'tmp'),
  posts: require('./fixtures/posts'),
  users: require('./fixtures/users'),
}

// Test helpers
if (!fs.existsSync(fixtures.db)) fs.mkdirSync(fixtures.db)
var testNum = 0
var test = function(label, fn) {
  testNum++
  var ctx = {}
  ctx.rest = rest(levelup(path.join(fixtures.db, 'db' + testNum), {valueEncoding: 'json'}))
  async.each(['users', 'posts'], function(fixture, next) {
    async.each(fixtures[fixture], function(f, n) {
      ctx.rest.post(fixture, f, n)
    }, next)
  }, function() {
    tape(label, fn.bind(ctx))
  })
}

test('serialize', function(t) {
  t.plan(3)
  var result = this.rest.serialize('posts')
  var expect = { api: 'posts', id: null, singular: 'post' }
  t.deepEqual(result, expect, 'serialize should have serialized posts')

  result = this.rest.serialize('posts/2')
  expect = { api: 'posts', id: '2', singular: 'post' }
  t.deepEqual(result, expect, 'serialize should have serialized posts/2')

  result = this.rest.serialize('posts/')
  expect = { api: 'posts', id: null, singular: 'post' }
  t.deepEqual(result, expect, 'serialize should have serialized posts/')
})

test('get posts', function(t) {
  t.plan(1)
  var result = null
  var expect = fixtures.posts
  this.rest.get('posts').pipe(concat(function(results) {
    t.deepEqual(results, expect, 'posts should have equaled the expected posts')
  }))
})

test('get posts/2', function(t) {
  t.plan(1)
  var result = null
  var expect = [fixtures.posts[1]]
  this.rest.get('posts/2').pipe(concat(function(result) {
    t.deepEqual(result, expect, 'posts/2 should have equaled the expected post')
  }))
})

// test('get posts belongsTo users', function(t) {
//   t.plan(4)
//   var result = null
//
//   var getStream = this.rest.get('posts')
//   var opts = {
//     model: 'users',
//     api: this.rest.serialize('posts'),
//     db: this.rest.db.sublevel('users')
//   }
//   getStream
//     .pipe(foreign.belongsTo(opts))
//     .pipe(concat(function(results) {
//       for (var i = 0; i < results.length; i++) {
//         var post = results[i]
//         t.equal(post.title, fixtures.posts[i].title, 'posts title was not correctly set')
//         t.equal(post.user.name, fixtures.users[i].name, 'users belonging to posts didnt get set correctly')
//       }
//     }))
// })
//
// test('get posts/2 belongsTo users', function(t) {
//   t.plan(1)
//   var result = null
//   var expect = { post: fixtures.posts[1], user: fixtures.users[1], meta: {} }
//
//   var getStream = this.rest.get('posts/2')
//   var opts = {
//     model: 'users',
//     api: this.rest.serialize('posts/2'),
//     db: this.rest.db.sublevel('users')
//   }
//   getStream
//     .pipe(foreign.belongsTo(opts))
//     .pipe(concat(function(results) {
//       t.deepEqual(result, expect, 'posts/2 belongsTo users should have included user')
//     }))
//
//
// })
//
// test('get users/2 hasMany posts', function(t) {
//   t.plan(1)
//   var result = null
//   var expect = { post: fixtures.posts[1], user: fixtures.users[1], meta: {} }
//
//   var getStream = this.rest.get('users/2')
//   var opts = {
//     model: 'posts',
//     api: this.rest.serialize('users/2'),
//     db: this.rest.db.sublevel('posts')
//   }
//   getStream
//     .pipe(foreign.belongsTo(opts))
//     .on('data', function(data) {
//       result = data
//     }).on('end', function() {
//       t.deepEqual(result, expect, 'posts/2 belongsTo users should have included user')
//     })
// })

test('post posts', function(t) {
  t.plan(3)
  var self = this
  var result = null
  this.rest.post('posts', { id: 99, title: 'dude' }, function(err) {
    t.notOk(err, 'no post err')
    self.rest.get('posts/99').pipe(concat(function(results) {
      t.equal(results[0].id, 99, 'put posts/99 should have left the body alone')
      t.equal(results[0].title, 'dude', 'put posts/99 should have put the title')
    }))
  })
})

test('put posts/2', function(t) {
  t.plan(2)
  var self = this
  var result = null
  this.rest.put('posts/2', { title: 'dude' }, function(err) {
    t.notOk(err, 'no post err')
    self.rest.get('posts/2').pipe(concat(function(results) {
      t.equal(results[0].title, 'dude', 'put posts/2 should have put the title')
    }))
  })    
})

test('delete posts/1', function(t) {
  t.plan(2)
  var self = this
  var result = null
  var expect = fixtures.posts.slice(1)
  this.rest.delete('posts/1', function(err) {
    t.notOk(err, 'no delete err')
    self.rest.get('posts').pipe(concat(function(results) {
      t.deepEqual(results, expect, 'post/1 should have been deleted')
    }))
  })
})

// Clean up on exit
process.on('exit', function() {
  rimraf.sync(fixtures.db)
})
