var tape = require('tape')
var rest = require('../')
var levelup = require('level')
var rimraf = require('rimraf')
var path = require('path')
var fs = require('fs')
var async = require('async')

var fixtures = {
  db: path.resolve(process.cwd(), 'tmp'),
  posts: require('./fixtures/posts'),
}

// Test helpers
if (!fs.existsSync(fixtures.db)) fs.mkdirSync(fixtures.db)
var testNum = 0
var test = function(label, fn) {
  testNum++
  var ctx = {}
  ctx.rest = rest(levelup(path.join(fixtures.db, 'db' + testNum), {valueEncoding: 'json'}))
  async.each(fixtures.posts, function(post, next) {
    ctx.rest.post('posts', post, next)
  }, function() {
    tape(label, fn.bind(ctx))
  })
}

test('serialize', function(t) {
  t.plan(3)
  var result = this.rest.serialize('posts')
  var expect = { api: 'posts', id: null }
  t.deepEqual(result, expect, 'serialize should have serialized posts')

  result = this.rest.serialize('posts/2')
  expect = { api: 'posts', id: '2' }
  t.deepEqual(result, expect, 'serialize should have serialized posts/2')

  result = this.rest.serialize('posts/')
  expect = { api: 'posts', id: null }
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

test('get post/2', function(t) {
  t.plan(1)
  var result = null
  var expect = { post: fixtures.posts[1], meta: {} }
  this.rest.get('posts/2').on('data', function(data) {
    result = data
  }).on('end', function() {
    t.deepEqual(result, expect, 'posts/2 should have equaled the expected post')
  })
})

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

// Clean up on exit
process.on('exit', function() {
  rimraf.sync(fixtures.db)
})
