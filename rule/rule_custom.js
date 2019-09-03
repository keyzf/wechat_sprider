/***
 * 自定义规则文件
 * @type {{doParser, log, loadLocalParser, initParser, PARSER_MAPPER}|*}
 */
var parserHandler = require('../parser_handler');
var config = require('../config/config');
var utils  = require('../utils/utils');
var work   = require('../utils/work'); 

var RULE_NAME = 'article_list';


var testJSON = {
    url:"https://mp.weixin.qq.com/mp/getappmsgext?f=json&mock=&uin=777&key=777&pass_ticket=OEhyH0CvFdeOhuJ%25252FTn10exJLWvAH1pHaSy0PtIPFbMWAYr4uKQFRdmKnDjGJbRro"+
    "&wxtoken=777&devicetype=iOS12.3.1&clientversion=17000529&appmsg_token=1024_WBD3AVqloeRyY5LgTHPvfWWNqZkG60uqt3gwaoV5Xb7iNimAIJfzl380A0iMfYwJDjDa7kFT66U9AdKw&x5=0&f=json",
    headers:{
        'Host' :'mp.weixin.qq.com',
        'Accept' :'*/*',
        'Cookie' :''
    }
} 

const userInfo = {};

/**
 * 设置提示文本
 */
function getNotification () {
    return '<h1 style="color:red; font-size:50px; text-align: center; margin-top: 10px; margin-bottom: 10px;">正在进行文章数据采集...... '+ '</h1>';
}

/**
 * 解析用户指纹 在拼装自定义url中需要用到的
 * 需要解析的字段：[pass_ticket,wap_sid2,wxtokenkey,wxuin,version,appmsg_token]
 */
function parserUserBaseInfo(requestDetail){
    utils.log('【Start parser user info】',config.LOG._LOG_LEVEL_DEBUG);
    //解析原始请求的Cookie
    try{
        const cookies = requestDetail.requestOptions.headers.Cookie;
        const cookieArray = cookies.split(';');
    
        for (let i = 0; i < cookieArray.length; i++) {
            
            const cookieColunm = cookieArray[i];
            const cookieKV = cookieColunm.split('=');
            if(cookieKV.length > 1){
                userInfo[cookieKV[0].trim()] = cookieKV[1];
            }
        }

    
    }catch(e){
        utils.log('【Parser user info fail】:' + e.message,config.LOG._LOG_LEVEL_ERROR);
        return;
    }
    utils.log('【The user cookies parser success】')
    utils.log('【UserInfo:】' + JSON.stringify(userInfo),config.LOG._LOG_LEVEL_INFO);
}
  


module.exports = {
    summary: "抓取微信公众号历史文章",
    * beforeSendResponse(requestDetail, responseDetail) {
        var THIS_MODULE = this;
        try {
            if (/mp\/homepage\?__biz=/.test(requestDetail.url)) {
                utils.log('【' + RULE_NAME + '】拦截成功......{homepage?}', config.LOG._LOG_LEVEL_INFO);
                const htmlString = responseDetail.response.body.toString();
                const result = parserHandler.doParser(htmlString, RULE_NAME);
                utils.log('【爬取到的公众号历史文章列表】' + JSON.stringify(result), config.LOG._LOG_LEVEL_INFO);

                //每次新请求都解析用户指纹
                parserUserBaseInfo(requestDetail);

                //发送数据到服务器端
                work.postArticleList(result,function(data){
                    utils.log('【Do commit data success. Prepare for the next step 】',config.LOG._LOG_LEVEL_ERROR);
                    //组装获取文章详情的url,自主请求
                    work.fetchArticleDetailInfo(data,userInfo);
                },function(){
                    utils.log('【Do commit data err!!! 】',config.LOG._LOG_LEVEL_ERROR);
                });

               
                //解析appmsg_token
                var appmsg_token_pattern = /window.appmsg_token = \"(.*?)\";/;
                var appmsg_token = appmsg_token_pattern.exec(htmlString)[1];
                userInfo.msgToken = appmsg_token;

                const newResponse = responseDetail.response;
                newResponse.body = htmlString +  getNotification();

                return new Promise(((resolve, reject) => {
                    setTimeout(() => {
                        resolve({response:newResponse});
                    })
                }));
            } else {
                return null;
            }
        } catch (e) {
            utils.log('Rule handler throw exception:' + e.message);
            return null;
        }
    },

    /**
     * 请求前的拦截操作
     * @param {请求实体} requestDetail 
     */
    * beforeSendRequest(requestDetail){
        
    },

    * beforeDealHttpsRequest(requestDetail){
        return true;
    }
};
