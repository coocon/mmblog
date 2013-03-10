var models = require('../../models')
  , Article = models.Article
  , util = require('../../util')
  , _ = require('underscore')
  , markdown = require('markdown').markdown
  , EventProxy = require('eventproxy');

function createArticle(newArticle, cb) {
    var article = new Article();
    article.title = newArticle.title;
    article.content = newArticle.content;
    article.preview = newArticle.preview;
    article.createTime = newArticle.createTime || new Date();
    //文章创建时,createTime === updateTime
    article.updateTime = newArticle.createTime || new Date();
    article.save(function(err, article) {
        if (err) {
            return cb(err); 
        }     

        return cb(null, article);
    });
}

function editArticle(id, newArticle, cb) {
    getArticleById(id, function(err, article) {
        if (err) {
            return cb(err); 
        } 
        article.title = newArticle.title;
        article.content = newArticle.content;
        article.preview = newArticle.preview;
        article.updateTime = new Date();
        
        article.save(function(err, article) {
            if (err) {
                return cb(err); 
            }     
            return cb(null, article);
        });
    });
}

function getArticleByQuery(query, fields ,opt, cb) {
    //查询字段不为空并且是数组 就转化一下子 因为
    //新的mongoose就是这么搞的不然会报错
    if ( fields && ('Array' == fields.constructor.name) ) {
        fields = null;
    }
    Article.find(query, fields, opt, function(err, articles) {
        if (err) {
            return cb(err); 
        } 
        return cb(null, articles); 
    });
}

function getArticleById(id, cb) {
    Article.findOne({_id: id}, function(err, article) {
        if (err) {
            return cb(err); 
        }
        return cb(null, article); 
    });
}

function getNeighborArticle(id, cb) {
    getArticleByQuery({}, ['_id'], {sort: {'createTime': 1}}, function(err, articles) {
        if (err) {
            return cb(err); 
        }
        var ids = _.pluck(articles, '_id')
          , index;

        for (var i=0,len=ids.length; i<len; i++) {
            if (id == ids[i]) {
                index = i;
                break; 
            } 
        }

        cb(null, {
            previous: index == 0 ? 0 : ids[index - 1], 
            next: index == len - 1 ? 0 : ids[index + 1]
        });
    });
}

/*
 * 获取blog列表
 */
exports.list = function(req, res, next) {
    //XXX: 新版的mongoose很不够意思，fields传入空的[]，
    //也会报错！！
    getArticleByQuery({}, [], {sort: {'createTime': -1}}, function(err, articles) {
        if (err) {
            return next(err);   
        }        
        _.each(articles, function(article, index, list) {
            list[index] = {
                _id: article._id, 
                title: article.title, 
                //使用markdown转化为html.
                content: markdown.toHTML(article.preview), 
                commentCount: article.commentCount,
                createTime: util.convertTime(article.createTime)
            }; 
        });
        res.json(200, articles);
    });
}

/*
 * 获取最近blog列表
 */
exports.recent = function(req, res, next) {
    getArticleByQuery({}, ['title', '_id', 'createTime', 'updateTime'], {limit: 10, sort: {'createTime': -1}}, function(err, articles) {
        if (err) {
            return next(err);   
        } 
        res.json(200, articles);
    });
}

/*
 * 获取blog
 */
exports.one = function(req, res, next) {
    var id = req.params.id 
      , ep = new EventProxy();

    ep.assign('article', 'neighbor', function(article, neighbor) {
        res.json(200, _.extend(article, neighbor)); 
    });

    getArticleById(id, function(err, article) { 
        if (err) {
            return next(err);   
        }      
        ep.emit('article', {
            _id: article._id, 
            title: article.title, 
            //使用markdown转化为html.
            content: markdown.toHTML(article.content), 
            createTime: util.convertTime(article.createTime) 
        });
    }); 
    getNeighborArticle(id, function(err, neighbor) {
        if (err) {
            return next(err);   
        }         
        ep.emit('neighbor', neighbor);
    });
}

exports.createArticle = createArticle;
exports.editArticle = editArticle;
exports.getArticleByQuery = getArticleByQuery;
exports.getArticleById = getArticleById;
