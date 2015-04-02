var restServer = 'https://consumit-rest-nodejs.herokuapp.com/api/';

//gets the url of the current tab and saves the link
function saveLinks(e) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
      //console.log('Saved: ' + tabs[0].url);
      saveLink(tabs[0].url, window.close);
  });
}

//creates a list of all saved links
//may need to add pages to support lots of links
function showLinks(e) {
  chrome.storage.local.get('user', function(c) {
    if(!c.user) {
      document.getElementById('viewDiv').innerHTML = '<div><span id="closeLink">Close</span></div>';
      document.getElementById('closeLink').addEventListener('click', hideLinks);
      return;
    }
    //console.log(restServer+'users/'+c.user.uid);
    $.ajax({
      method: 'get',
      url: restServer+'users/'+c.user.uid,
      success: function(data, textStatus, jqXHR) {
          var linkList;
          linkList= '<ul>';
          linkList += '<li><div><span id="closeLink">Close</span></div></li>';
          console.log(data);
          for (var i in data.user._consumptions) {
            var consumption = data.user._consumptions[i];
            linkList += '<li><div><span id="'+consumption._id+'">'+consumption._consumable.url+'</span></div></li>';
          }
          linkList += '</ul>';
          //console.log(linkList);
          document.getElementById('viewDiv').innerHTML = linkList;
          //set listeners to links (for custom tab opening)
          //replicates an <a> with some more js added
          for(var i in data.user._consumptions) {
            var consumption = data.user._consumptions[i];
            console.log(consumption._consumable.url);
            document.getElementById(consumption._id).addEventListener('click', constructListener(consumption._consumable.url));
          }
          document.getElementById('closeLink').addEventListener('click', hideLinks);
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('error: '+errorThrown);
      },
      complete: function(jqXHR, textStatus) {
        console.log('complete: '+textStatus);
      }
    });
  });
}

// add credentials to all ajax calls
function login() {
  var username = $('#username').val();
  var password = $('#password').val();
  console.log('beginning login');

  $.ajaxSetup({
    headers: { 'Authorization': 'Basic '+btoa(username+':'+password) },
  });

  console.log('testing login');
  $.ajax({
    method: 'get',
    url: restServer+'me',//needs to be changed somehow to change depending on email and pw (since uid is unknown at this state)
    success: function(data, textStatus, jqXHR) {
      console.log('login success');
      
      chrome.storage.local.get('user', function(c){
        if(!c.user) {
          c = {};
          c.uid = data.user._id;
        }
        chrome.storage.local.set({'user': c});//update the storage
      });
      
      document.getElementById('loginDiv').innerHTML = '<span id="loginLink">Logout</span>';
      document.getElementById('loginLink').addEventListener('click', logoutUser);
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log(errorThrown);
    }
  });
}

function logoutUser(e) {
  $.ajaxSetup({headers: {}});
  document.getElementById('loginDiv').innerHTML = '<span id="loginLink">Login</span>';
  document.getElementById('loginLink').addEventListener('click', loginUser);
  clearConsumables();
}

// create login form
function loginUser(e) {
  var loginForm = '<input id="username" type="text" name="username" placeholder="Username">';
  loginForm += '<input id="password" type="password" name="password" placeholder="Password">';
  loginForm += '<button id="loginBtn">Login</button>';
  document.getElementById('loginDiv').innerHTML += loginForm;
  document.getElementById('loginBtn').addEventListener('click', login);
  var loginLink = document.getElementById('loginLink');
  loginLink.removeEventListener('click', loginUser);
  loginLink.addEventListener('click', closeLogin);
}

function closeLogin(e) {
  var loginDiv = document.getElementById('loginDiv');
  loginDiv.innerHTML = '<div id="loginDiv"><span id="loginLink">Login</span></div>';
  
  var loginLink = document.getElementById('loginLink');
  loginLink.removeEventListener('click', closeLogin);
  loginLink.addEventListener('click', loginUser);
}

//can't have a function that references an external variable so need to make one
function constructListener(link) {
  link = 'https://' + link + '/';//links no longer come with a full url
  var f = function(){
    chrome.tabs.create({ url: link }, function(tab) {
      chrome.runtime.sendMessage(tab);
    });
  }
  return f;
}

//close the list of links
function hideLinks(e) {
  var viewDiv = document.getElementById('viewDiv');
  viewDiv.innerHTML = '<span id="viewLink">View Consumables</span>';
  document.getElementById('viewLink').addEventListener('click', showLinks);
}

function clearConsumables() {
  chrome.storage.local.clear();
}

function stripFragment(url) {
  return url.split('#')[0];
}

function saveLink(url, cb) {
  url = stripFragment(url);
  url = url.replace(/.*?:\/\//g, "");
  
  chrome.storage.local.get('user', function(c) {
    if(!c.user) {
      cb();//no user, don't save
      return;
    }
    //console.log(restServer+'users/'+c.user.uid);
    $.ajax({
      method: 'get',
      url: restServer+'consumables/',
      success: function(data, textStatus, jqXHR) {
        if(!findUrl(url, data.consumables)) { //if url is not already in consumables
          $.ajax({
            url: restServer+'consumables/',
            method: 'post',
            dataType: 'json',
            data: {
              consumable: {
                url: url
              }
            },
            success: function(data2, textStatus, jqXHR) {
              addConsumable(c.user.uid, data2.consumable._id, cb);
            }
          });
        }
        else {
          var cid = data.consumables[findUrl(url, data.consumables)]._id;
          addConsumable(c.user.uid, cid, cb);
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('error: '+errorThrown);
      },
      complete: function(jqXHR, textStatus) {
        console.log('complete: '+textStatus);
      }
    });
  });
}

function addConsumable(uid, cid, cb) {
  $.ajax({
    url: restServer+'consumptions/',
    method: 'post',
    dataType: 'json',
    data: {
      consumption: {
        _user: uid,
        _consumable: cid
      }
    },
    success: function(data, textStatus, jqXHR) {
      console.log(data);
      return;
      cb();
    }
  });
}

function findUrl(url, consumables) {
  for(var i in consumables) {
    if(consumables[i].url === url)
      return i;
  }
  return false;
}

document.addEventListener('DOMContentLoaded', function () {  
  chrome.storage.local.get('user', function(c){
    if(!c) { //if not logged in
      document.body.innerHTML += '<div id="loginDiv"><span id="loginLink">Login</span></div>';
      document.getElementById('loginLink').addEventListener('click', loginUser);
    }
    else {
      document.body.innerHTML += '<div id="loginDiv"><span id="loginLink">Logout</span></div>';
      document.getElementById('loginLink').addEventListener('click', logoutUser);
    }
    
    var saveDiv = document.getElementById('saveLink');
    saveDiv.addEventListener('click', saveLinks);

    var viewLink = document.getElementById('viewLink');
    viewLink.addEventListener('click', showLinks);

    var clearLink = document.getElementById('clearLink');
    clearLink.addEventListener('click', clearConsumables);
  });
});
