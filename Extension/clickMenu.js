//////////////////////// Event Handlers /////////////////////////////

//Right Click
var title = "Consume later";
//Button only appears when right clicking a link
var id = chrome.contextMenus.create({
  "title": title,
  "contexts":['link'],
  "onclick": handleLink
});

function handleLink(info, tab) {
  //console.log(info.linkUrl);
  SessionManager.addConsumable(info.linkUrl);
}

//Tab switching
chrome.tabs.onActivated.addListener(function(activeInfo) {
  //Stop the timer if necessary
  if(TimeManager.tabIds.indexOf(TimeManager.prevTabId) !== -1) {
    chrome.tabs.get(TimeManager.prevTabId, function(t){
      TimeManager.stopTimer(t.url);
      //Update the previous tab id
      TimeManager.prevTabId = activeInfo.tabId;
      //Start the timer if necessary
      if(TimeManager.tabIds.indexOf(activeInfo.tabId) !== -1) {
        chrome.tabs.get(TimeManager.prevTabId, function(t){
          TimeManager.startTimer(t.url);
        })
      }
    })
  }
  else{
    //Update the previous tab id
    TimeManager.prevTabId = activeInfo.tabId;
    //Start the timer if necessary
    if(TimeManager.tabIds.indexOf(activeInfo.tabId) !== -1) {
      chrome.tabs.get(TimeManager.prevTabId, function(t){
        TimeManager.startTimer(t.url);
      })
    }
  }
});

//Tracked tab being closed
chrome.tabs.onRemoved.addListener(function(tabId){
  if(TimeManager.tabIds.indexOf(tabId) !== -1){
    TimeManager.stopTimer(TimeManager.tabToUrl[tabId]);
  }
  if(TimeManager.prevTabId === tabId){
    TimeManager.prevTabId = -1;
  }
});

chrome.tabs.onUpdated.addListener(function(tabId, info, tab){
  if(TimeManager.prevTabId === tabId && TimeManager.tabToUrl[tabId]){
    if(info.status === 'loading'){
      if(Util.normalize(info.url) !== TimeManager.tabToUrl[TimeManager.prevTabId]){
        TimeManager.stopTimer(TimeManager.tabToUrl[TimeManager.prevTabId]);
        delete TimeManager.tabIds[TimeManager.tabIds.indexOf(tab.id)];
      }
    }
  }
  TimeManager.tabToUrl[tabId] = Util.normalize(tab.url);
});

//Receiving message from popup
chrome.runtime.onMessage.addListener(function(msg, sender, cb) {
  switch(msg.type){
    case 'startTimer':
      //Need to start timer for the new tab
      TimeManager.initTimer(msg.tab);
      break;
    case 'getActiveTabs':
      //Request for all tracked tab ids
      cb(TimeManager.tabIds);
      break;
    case 'getTime':
      //Request for time spent at a specific url
      cb(TimeManager.getTime(msg.url));
      break;
    case 'logout':
      //Logout request(clear header)
      SessionManager.clearHeader();
      break;
    case 'login':
      //Login request (set header)
      SessionManager.setHeader(msg.user, msg.pass);
      SessionManager.initSession();
      break;
    case 'saveLink':
      //Save a consumable for the current user
      SessionManager.addConsumable(msg.url);
      break;
    case 'consumeLink':
      //Complete consumption of a link
      SessionManager.completeConsumption(msg.url);
      break;
    case 'getConsumptions':
      //Get all consumptions for current user
      SessionManager.getConsumptions();
      break;
    case 'checkState':
      //Check if user logged in
      cb(SessionManager.getState());
      break;
    case 'getTopConsumables':
      //Get top n consumables
      SessionManager.getTopConsumables(10);
      break;
    case 'deleteConsumption':
      //Get top n consumables
      SessionManager.deleteConsumption(msg.consumptionId);
      break;
  }
});

//////////////////////////////// Timer /////////////////////////////////////////

//Controls all timing information (tracked tabs, times)
var TimeManager = {
  tabToUrl: {}, //urls indexed by tabId
  totalTimes: {}, //total time spent at a url in the current browser session
  startTimes: {}, //the start times, indexed by url, removed when timer stopped
  tabIds: [], //the tracked tab ids (used for tracking tab switching)
  prevTabId: -1, //the previous active tab id (checked after tab switch)
  initTimer: function(tab){ //start the tiemr for a new tab
    this.tabIds.push(tab.id);
    this.startTimer(tab.url);
  },
  startTimer: function(url){ //Start the timer for a url, assumes url is unique to a tab (still works if it's not)
    url = Util.normalize(url);
    var d = new Date();
    if(!this.startTimes[url]){
      this.startTimes[url] = d.getTime();
    }
  },
  stopTimer: function(url) {
    url = Util.normalize(url);
    if(!this.startTimes[url])
      return;
    var d = new Date();
    var time = d.getTime() - this.startTimes[url];
    if(!this.totalTimes[url]){
      this.totalTimes[url] = time;
    }
    else{
      this.totalTimes[url] += time;
    }
    delete this.startTimes[url];
  },
  getTime: function(url){
    url = Util.normalize(url);
    this.stopTimer(url);
    return this.totalTimes[url];
  }
}

//////////////////////////////////// Util ////////////////////////////////////////

var Util = {
  clearConsumables: function(){
    chrome.storage.local.clear();
  },
  normalize: function(url){ //Strip the fragment from a url (so a single page doesn't appear as a different page)
    url = url.split('#')[0];
    url = url.replace(/.*?:\/\//g, "");
    return url;
  },
  findUrl: function(url, consumables){ //check if the url has a consumable connected with it
    url = Util.normalize(url);
    for (var i in consumables) {
      if (consumables[i].url === url)
        return i;
    }
    return false;
  },
  findCid: function(url, consumptions){ //get the consumption id of the url and current user
    for(var i in consumptions){
      if(consumptions[i]._consumable.url === url){
        return consumptions[i]._id;
      }
    }
    return false;
  }
}

////////////////////////// Database Information //////////////////////////////////

var restServer = 'https://consumit-rest-nodejs.herokuapp.com/api/';

//Manages all information about the current user and the connection to the rest server
var SessionManager = {
  user: 0, //The current user id
  cids: {}, //consumptions ids indexed by url
  setHeader: function(user, pass){ //Equal to login
    console.log('Setting user info header');
    $.ajaxSetup({
      headers: {
        'Authorization': 'Basic ' + btoa(user + ':' + pass)
      }
    });
  },
  initSession: function(){ //Initialize the session (and get user id)
    console.log('Starting new session');
    $.ajax({
      method: 'get',
      url: restServer + 'me',
      success: function(response, textStatus, jqXHR) {
        console.log('Logged in ' + response.user._id);
        SessionManager.user = response.user._id;//can't use this because cb is called outside of object
        chrome.runtime.sendMessage({
          type: 'update'
        });
        chrome.runtime.sendMessage({
          type: 'loginSuccess'
        });
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log(errorThrown);
      }
    });
  },
  clearHeader: function(){ //Equal to logout
    $.ajaxSetup({
      headers: {}
    });
    this.user = 0;
    console.log(SessionManager);
  },
  completeConsumption: function(url, time){ //Completes a consumption (sets consume time)
    url = Util.normalize(url);
    if(!this.user){
      console.log('No user logged in');
      return;
    }
    $.ajax({
      method: 'get',
      url: restServer + 'me',
      success: function(data, textStatus, jqXHR) {
        var cid = Util.findCid(url, data.user._consumptions);
        var time = TimeManager.getTime(url);
        //console.log(cid);
        //console.log(time);
        SessionManager.consumeLink(time, cid);
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('Error getting consumables: ' + errorThrown);
      }
    });
  },
  consumeLink: function (time, cid){
    $.ajax({
      method: 'put',
      url: restServer + 'consumptions/' + cid,
      contentType: "application/json",
      data: JSON.stringify({
        "consumption": {
          "consumeTime": time,
          "consumed": true
        }
      }),
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('Error completing consumption: ' + errorThrown);
      },
      success: function(data, textStatus, jqXHR) {
        console.log('Completed consumption: ');
        console.log(data);
      }
    });
  },
  addConsumption: function(cid){ //Creates a new consumption (saves link for current user)
    if(!this.user){
      console.log('No user logged in');
      return;
    }
    $.ajax({
      url: restServer + 'consumptions/',
      method: 'post',
      dataType: 'json',
      data: {
        consumption: {
          "_user": this.user,
          "_consumable": cid
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('Error adding consumption: ' + errorThrown);
      },
      success: function(data, textStatus, jqXHR) {
        console.log('Added consumption: ');
        console.log(data);
      }
    });
  },
  addConsumable: function(url){ //Creates a consumable (check for new link and add if necessary) and then adds to user
    url = Util.normalize(url);
    if(!this.user){
      console.log('No user logged in');
      return;
    }
    $.ajax({
      method: 'get',
      url: restServer + 'consumables',
      success: function(data, textStatus, jqXHR) {
        if (!Util.findUrl(url, data.consumables)) { //if url is not already in consumables add it
          $.ajax({
            url: restServer + 'consumables/',
            method: 'post',
            dataType: 'json',
            data: {
              consumable: {
                url: url
              }
            },
            error: function(jqXHR, textStatus, errorThrown) {
              console.log('Error adding consumable: ' + errorThrown);
            },
            success: function(data2, textStatus, jqXHR) {
              //and then add the consumption
              SessionManager.addConsumption(data2.consumable._id);
            }
          });
        }
        else {
          //else just add the consumption
          var cid = data.consumables[Util.findUrl(url, data.consumables)]._id;
          SessionManager.addConsumption(cid);
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('Error getting consumables: ' + errorThrown);
      }
    });
  },
  getConsumptions: function(){
    if(!this.user){
      console.log('No user logged in');
      return;
    }
    $.ajax({
      url: restServer + 'users/' + this.user,
      method: 'get',
      dataType: 'json',
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('Error getting consumptions: ' + errorThrown);
      },
      success: function(data){
        chrome.runtime.sendMessage({
          type: 'consumptions',
          response: data
        });
      }
    });
  },
  getTopConsumables: function(n) {
    $.ajax({
      url: restServer + 'top/' + n,
      method: 'get',
      dataType: 'json',
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('Error getting top ' + n + ' consumptions: ' + errorThrown);
      },
      success: function(data){
        chrome.runtime.sendMessage({
          type: 'topConsumables',
          response: data
        });
      }
    });
  },
  deleteConsumption: function(consumptionId) {
    $.ajax({
      url: restServer + 'consumptions/' + consumptionId,
      method: 'delete',
      dataType: 'json',
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('Error deleting consumption ' + consumptionId + ': ' + errorThrown);
      },
      success: function(data){
        chrome.runtime.sendMessage({
          type: 'deleteSuccess',
          response: data
        });
      }
    });
  },
  getState: function(){
    return this.user !== 0;
  }
}
