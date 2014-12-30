var tape = require('tape')
var rest = require('../')
var levelup = require('level')
var rimraf = require('rimraf')
var path = require('path')
var fs = require('fs')
var async = require('async')
var through = require('through')

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
  var expect = { posts: fixtures.posts, meta: {} }
  this.rest.get('posts').on('data', function(data) {
    result = data
  }).on('end', function() {
    t.deepEqual(result, expect, 'posts should have equaled the expected posts')
  })
})

test('get posts/2', function(t) {
  t.plan(1)
  var result = null
  var expect = { post: fixtures.posts[1], meta: {} }
  this.rest.get('posts/2').on('data', function(data) {
    result = data
  }).on('end', function() {
    t.deepEqual(result, expect, 'posts/2 should have equaled the expected post')
  })
})

test('get posts belongsTo users', function(t) {
  t.plan(4)
  var result = null
  this.rest.get('posts').belongsTo('users').on('data', function(data) {
    result = data
  }).on('end', function() {
    for (var i = 0; i < result.posts.length; i++) {
      var post = result.posts[i]
      t.equal(post.title, fixtures.posts[i].title, 'posts title was not correctly set')
      t.equal(post.user.name, fixtures.users[i].name, 'users belonging to posts didnt get set correctly')
    }
  })
})

test('get posts/2 belongsTo users', function(t) {
  t.plan(1)
  var result = null
  var expect = { post: fixtures.posts[1], user: fixtures.users[1], meta: {} }
  this.rest.get('posts/2').belongsTo('users').on('data', function(data) {
    result = data
  }).on('end', function() {
    t.deepEqual(result, expect, 'posts/2 belongsTo users should have included user')
  })
})

// test('get users/2 hasMany posts', function(t) {
//   t.plan(1)
//   var result = null
//   var expect = { post: fixtures.posts[1], user: fixtures.users[1], meta: {} }
//   this.rest.get('users/2').belongsTo('posts').on('data', function(data) {
//     result = data
//   }).on('end', function() {
//     t.deepEqual(result, expect, 'posts/2 belongsTo users should have included user')
//   })
// })

test('post posts', function(t) {
  t.plan(2)
  var result = null
  this.rest.post('posts', { id: 99, title: 'dude' }, function() {
    this.rest.get('posts/99').on('data', function(data) {
      result = data
    }).on('end', function() {
      t.equal(result.post.id, 99, 'put posts/99 should have left the body alone')
      t.equal(result.post.title, 'dude', 'put posts/99 should have put the title')
    })
  }.bind(this))
})

test('stream to post', function(t) {
  t.plan(2)
  var result = null
  var req = through()
  req.pipe(this.rest.post('posts')).on('end', function() {
    this.rest.get('posts/99').on('data', function(data) {
      result = data
    }).on('end', function() {
      t.equal(result.post.id, 99, 'put posts/99 should have left the body alone')
      t.equal(result.post.title, 'dude', 'put posts/99 should have put the title')
    })
  }.bind(this))
  req.write({ id: 99, title: 'dude' })
  req.end()
})

test('put posts/2', function(t) {
  t.plan(2)
  var result = null
  this.rest.put('posts/2', { title: 'dude' }, function() {
    this.rest.get('posts/2').on('data', function(data) {
      result = data
    }).on('end', function() {
      t.equal(result.post.body, 'This is a post body number 2', 'put posts/2 should have left the body alone')
      t.equal(result.post.title, 'dude', 'put posts/2 should have put the title')
    })
  }.bind(this))
})

test('stream to put', function(t) {
  t.plan(2)
  var result = null
  var req = through()
  req.pipe(this.rest.put('posts/2')).on('end', function() {
    this.rest.get('posts/2').on('data', function(data) {
      result = data
    }).on('end', function() {
      t.equal(result.post.body, 'This is a post body number 2', 'put posts/2 should have left the body alone')
      t.equal(result.post.title, 'dude', 'put posts/2 should have put the title')
    })
  }.bind(this))
  req.write({ title: 'dude' })
  req.end()
})

test('delete posts/1', function(t) {
  t.plan(1)
  var result = null
  var expect = { posts: fixtures.posts.slice(1), meta: {} }
  this.rest.delete('posts/1', function() {
    this.rest.get('posts').on('data', function(data) {
      result = data
    }).on('end', function() {
      t.deepEqual(result, expect, 'post/1 should have been deleted')
    })
  }.bind(this))
})

test('delete posts/1', function(t) {
  t.plan(1)
  var result = null
  var expect = { posts: fixtures.posts.slice(1), meta: {} }
  var req = through()
  req.pipe(this.rest.delete('posts/1')).on('data', function(data) {
    result = data
  }).on('end', function() {
    this.rest.get('posts').on('data', function(data) {
      result = data
    }).on('end', function() {
      t.deepEqual(result, expect, 'post/1 should have been deleted')
    })
  }.bind(this))
  req.write(1)
  req.end()
})

// Clean up on exit
process.on('exit', function() {
  rimraf.sync(fixtures.db)
})
