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
  var linkList;

  $.ajax({
    method: 'get',
    url: restServer+'me',
    success: function(data, textStatus, jqXHR) {
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

  chrome.storage.local.get('consumables', function(c){
    return; // ignoring this for now to work on hitting the api
    //console.log(JSON.stringify(c.consumables));
    linkList = '<ul>\n';
    linkList += '<li><div><span id="closeLink">Close</span></div></li>\n';
    for(var i in c.consumables) {
      //console.log(c.consumables[link]);
      linkList += '<li><div><span id="'+i+'">'+i+'</span></div></li>\n';
    }
    linkList += '</ul>\n';
    //console.log(linkList);
    document.getElementById('viewDiv').innerHTML = linkList;
    //set listeners to links (for custom tab opening)
    //replicates an <a> with some more js added
    for(var i in c.consumables) {
      document.getElementById(i).addEventListener('click', constructListener(i));
    }
    document.getElementById('closeLink').addEventListener('click', hideLinks);
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
    url: restServer+'me',
    success: function(data, textStatus, jqXHR) {
      console.log('login success');
      document.getElementById('loginDiv').innerHTML = '<span id="loginLink">Logout</span>';
      document.getElementById('loginLink').addEventListener('click', function() {
        $.ajaxSetup({headers: {}});
        document.getElementById('loginDiv').innerHTML = '<span id="loginLink">Login</span>';
        document.getElementById('loginLink').addEventListener('click', loginUser);
      });
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log(errorThrown);
    }
  });
}

// create login form
function loginUser(e) {
  var loginForm = '<input id="username" type="text" name="username" placeholder="Username">';
  loginForm += '<input id="password" type="password" name="password" placeholder="Password">';
  loginForm += '<button id="loginBtn">Login</button>';
  var loginLink = document.getElementById('loginLink');
  loginLink.removeEventListener('click', loginUser);
  loginLink.addEventListener('click', closeLogin);
  loginLink.innerHTML += loginForm;
  document.getElementById('loginBtn').addEventListener('click', login);
}

function closeLogin(e) {
  var loginLink = document.getElementById('loginLink');
  loginLink.removeEventListener('click', closeLogin);
  loginLink.addEventListener('click', loginUser);
  loginLink.innerHTML = '<div id="loginDiv"><span id="loginLink">Login (dev)</span></div>';
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
  chrome.storage.local.get('consumables', function(c){
    if(!c.consumables)
      c.consumables = {};
    if(!c.consumables[url]) //if the url is not already saved
      c.consumables[url] = {}; //save it
    chrome.storage.local.set({'consumables': c.consumables});//update the storage
    if(cb)
      cb();
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var saveDiv = document.getElementById('saveLink');
  saveDiv.addEventListener('click', saveLinks);

  var viewLink = document.getElementById('viewLink');
  viewLink.addEventListener('click', showLinks);

  var clearLink = document.getElementById('clearLink');
  clearLink.addEventListener('click', clearConsumables);

  var loginLink = document.getElementById('loginLink');
  loginLink.addEventListener('click', loginUser);
});
