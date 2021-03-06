var util = require('util');

module.exports = Gremlin;
Gremlin.apiVersion = "v1";

function Gremlin(client, type) {
  type = type || 'query';

  this.client = client;
  this.query =  function(text, callback) {
          return new Promise(function(resolve, reject){
    var uri = client.host + '/api/' + Gremlin.apiVersion + '/' + type + '/gremlin';
    var p = client.request.post({
      uri: uri,
      body: text,
      json: false
    }, function(err, res, body) {
        if(err) {
          if(typeof callback === 'function')
            err = (body && body.error) ? new Error(body.error) : err;
            callback(err);
            reject(err);
        }else {
            body = JSON.parse(body)
          if(typeof callback === 'function')
            callback(null, body);
            resolve(body);
        }

    });
      });
  };
}

Gremlin.prototype.type = function(type) {
  return new Gremlin(this.client, type);
};


Gremlin.prototype.Vertex = Gremlin.prototype.V = function() {
  var query = new Query(['V', toAry(arguments)]);
  query.query = this.query.bind(this);
  return query;
};


Gremlin.prototype.Morphism = Gremlin.prototype.M = function() {
  var path = new Path(['M']);
  path.query = this.query.bind(this);
  return path;
};

function Path() {
  this.calls = toAry(arguments);
}

var pathGenFun = function(method) {
  Path.prototype[method] = function() {
    this.calls.push([method, toAry(arguments)]);
    return this;
  };
};


// Basic Traversals
['Out', 'In', 'Both', 'Is', 'Has'].forEach(pathGenFun);


// Tagging
['Tag', 'As', 'Back', 'Save'].forEach(pathGenFun);

// Joining
['Intersect', 'Add', 'Union', 'Or'].forEach(pathGenFun);

// Using Morphisms
['Follow', 'FollowR'].forEach(pathGenFun);

Path.prototype.gremlinText = function() {
  if (!this.calls.length)
    return "";

  return 'g.' + this.calls.map(function(call) {
    var method = call[0];
    var args = call[1];
    return method + '(' + (args || []).map(argToString).join(',') + ')';
  }).join('.');
};


function Query() {
  Path.apply(this, arguments);
}

util.inherits(Query, Path);


Query.prototype.ForEach = function() {
  var self = this;
  var args = toAry(arguments);
  var lastArg = args[args.length -1];
  var callback;
  if (typeof lastArg == 'function' && lastArg.length == 2) {
    callback = args.pop();
  }

  self.calls.push(['ForEach', args]);
  return self.query(self.gremlinText(), callback);
};
['All', 'GetLimit', 'ToArray', 'ToValue', 'TagArray', 'TagValue'].forEach(function(method) {
  Query.prototype[method] = function() {
    var self = this;
    var args = toAry(arguments);
    var callback;
    if (typeof args[args.length - 1] == 'function')
      callback = args.pop();
    self.calls.push([method, args]);
    return self.query(self.gremlinText(), callback);
  };
});
function argToString(arg) {
  /* eqnull: true */
  if (arg == null) {
    return '' + arg;
  } else if (typeof arg === 'string') {
    return '"' + arg + '"';
  } else if (typeof arg == 'function') {
    return arg.toString();
  } else if (util.isArray(arg)) {
    return "[" + arg.map(argToString).join(",") + "]";
  } else if (arg.gremlinText) {
    return arg.gremlinText();
  } else {
    return arg.toString ? arg.toString() : new String(arg);
  }
}

function toAry(args) {
  return Array.prototype.slice.call(args);
}
