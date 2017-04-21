// Copyright (c) 2011+, HL7, Inc & The MITRE Corporation
// All rights reserved.
// 
// Redistribution and use in source and binary forms, with or without modification, 
// are permitted provided that the following conditions are met:
// 
//  * Redistributions of source code must retain the above copyright notice, this 
//    list of conditions and the following disclaimer.
//  * Redistributions in binary form must reproduce the above copyright notice, 
//    this list of conditions and the following disclaimer in the documentation 
//    and/or other materials provided with the distribution.
//  * Neither the name of HL7 nor the names of its contributors may be used to 
//    endorse or promote products derived from this software without specific 
//    prior written permission.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND 
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. 
// IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, 
// INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT 
// NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR 
// PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, 
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
// POSSIBILITY OF SUCH DAMAGE.

var mongoose = require('mongoose');
var _ = require('underscore');
var fs = require('fs');
var eco = require('eco');
var async = require('async');
var ExplanationOfBenefit = mongoose.model('ExplanationOfBenefit');
var ResourceHistory = mongoose.model('ResourceHistory');
var ResponseFormatHelper = require(__dirname + '/../../lib/response_format_helper');

exports.load = function(req, res, id, vid, next) {
  if (req.resourceHistory) {
    if(vid !== null){
      req.resourceHistory.getVersion(vid, function(err, explanationofbenefit) {
        req.explanationofbenefit = explanationofbenefit;
        next(explanationofbenefit);
      });
    } else {
      req.resourceHistory.findLatest(function(err, explanationofbenefit) {
        req.explanationofbenefit = explanationofbenefit;
        next(explanationofbenefit);
      });
    }
  } else {
    ResourceHistory.findOne(id, function(rhErr, resourceHistory) {
      if (rhErr) {
        next(rhErr);
      }
      if(resourceHistory !== null) {
        req.resourceHistory = resourceHistory;
        req.resourceHistory.findLatest(function(err, explanationofbenefit) {
          req.explanationofbenefit = explanationofbenefit;
          next(explanationofbenefit);
        });
      }
    });
  }
};

exports.show = function(req, res) {
  var explanationofbenefit = req.explanationofbenefit;
  var json = JSON.stringify(explanationofbenefit);
  res.send(json);
};

exports.create = function(req, res) {
  var explanationofbenefit = new ExplanationOfBenefit(req.body);
  explanationofbenefit.save(function(err, savedExplanationOfBenefit) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = new ResourceHistory({resourceType: 'ExplanationOfBenefit'});
      resourceHistory.addVersion(savedExplanationOfBenefit.id);
      resourceHistory.save(function(rhErr, savedResourceHistory){
        if (rhErr) {
          res.send(500);
        } else {
          res.set('Location', ("http://localhost:3000/explanationofbenefit/@" + resourceHistory.id));
          res.send(201);
        }
      });
    }
  });
};

exports.update = function(req, res) {
  var explanationofbenefit = req.explanationofbenefit;
  explanationofbenefit = _.extend(explanationofbenefit, req.body);
  explanationofbenefit.save(function(err, savedexplanationofbenefit) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = req.resourceHistory;
      resourceHistory.addVersion(savedexplanationofbenefit);
      resourceHistory.save(function(rhErr, savedResourceHistory) {
        if (rhErr) {
          res.send(500);
        } else {
          res.send(200);
        }
      });
    }
  });
};

exports.destroy = function(req, res) {
  var explanationofbenefit = req.explanationofbenefit;
  explanationofbenefit.remove(function (err) {
    if(err) {
      res.send(500);
    } else {
      res.send(204);
    }
  });
};

exports.list = function(req, res) {

  var content = {
    title: "Search results for resource type ExplanationOfBenefit",
    id: "http://localhost:3000/explanationofbenefit",
    totalResults: 0,
    link: {
      href: "http://localhost:3000/explanationofbenefit",
      rel: "self"
    },
    updated: new Date(Date.now()),
    entry: []
  };

  ResourceHistory.find({resourceType:"ExplanationOfBenefit"}, function (rhErr, histories) {
    if (rhErr) {
      return next(rhErr);
    }
    var counter = 0;
    async.forEach(histories, function(history, callback) {
      counter++;
      content.totalResults = counter;
      history.findLatest( function(err, explanationofbenefit) {
        var entrywrapper = {
          title: "ExplanationOfBenefit " + history.vistaId + " Version " + history.versionCount(),
          id: "http://localhost:3000/explanationofbenefit/@" + history.vistaId,
          link: {
            href: "http://localhost:3000/explanationofbenefit/@" + history.vistaId + "/history/@" + history.versionCount(),
            rel: "self"
          },
          updated: history.lastUpdatedAt(),
          published: new Date(Date.now()),
          content: explanationofbenefit
        };
        content.entry.push(entrywrapper);
        callback();
      });
    }, function(err) {
        res.send(JSON.stringify(content));
    });
  });
};