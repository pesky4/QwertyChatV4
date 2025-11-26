socket = io();
socket.emit("connecting");

var username = "";
var loggedIn = false;

var attachments = [];

var startedGames = [];
var joinedGames = [];

var users = {};

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function login(){
  var input = document.getElementById("usernameInput");
  input.value = input.value.trim();
  socket.emit("login",input.value,function(response){
    if (response.success) {
      username = input.value;
      loggedIn = true;
      document.getElementById("loginPopup").classList.add("slide-out-top");
      document.getElementById("roomInput").value = "Main";
      socket.emit("getUsers", (response)=>{
        users = response;
      });
    } else {
      alert("Failed: "+response.cause);
    }
  });
}

document.getElementById("usernameInput").addEventListener("keypress", function(event) {
  // If the user presses the "Enter" key on the keyboard
  if (event.key === "Enter") {
    // Cancel the default action, if needed
    event.preventDefault();
    // Trigger the button element with a click
    login();
  }
});


function joinRoom() {
  var roomID = document.getElementById("roomInput").value;
  socket.emit("joinRoom",roomID);
}

document.getElementById("roomInput").addEventListener("keypress", function(event) {
  // If the user presses the "Enter" key on the keyboard
  if (event.key === "Enter") {
    // Cancel the default action, if needed
    event.preventDefault();
    // Trigger the button element with a click
    joinRoom();
  }
});

socket.on("message", (user,contents,attachments) => {
  if (loggedIn) {
    var message = document.createElement("div");
    contents = contents.replace(/#(\S+)/g, '<a class="channel-link" data-channel="$1">#$1</a>');
    message.innerHTML = `${user} : ${contents}`;
    for (var link of message.getElementsByTagName('a')) {
      link.onclick = function(channel) {
        document.getElementById("roomInput").value = channel;
        joinRoom();
      }.bind(null,link.getAttribute("data-channel"));
    }

    message.classList.add("message");
    document.getElementById("messages").appendChild(message);
    for (var attachment of attachments) {
      if (attachment.type == "image") {
        var attachmentElement = document.createElement("img");
        attachmentElement.src = attachment.data;
        attachmentElement.classList.add("attachmentMessage");
        document.getElementById("messages").appendChild(attachmentElement);
      }
    }
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
  }
});

socket.on("serverMessage", (contents, icon) => {
  if (loggedIn) {
    var message = document.createElement("div");
    if (icon) {
      contents = "<img src='img/"+icon+"'>" + contents;
    }
    message.innerHTML = contents;
    message.classList.add("message");
    message.classList.add("serverMessage");
    document.getElementById("messages").appendChild(message);
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
  }
});

function createTicTacToeBoard(message,game) {
  message.innerHTML = "";
  var gameGrid = document.createElement("div");
  gameGrid.classList.add("tttGrid");
  gameGrid.id = `game-${game.id}`;
  message.appendChild(gameGrid);
  var updateFunc = function(id,pos) {
    socket.emit("updateGame",id,pos);
  };
  for (var i = 0; i < 9; i++) {
    var gridBox = document.createElement("button");
    gridBox.classList.add("tttTile");
    if (game.data[Math.floor(i/3)][Math.floor(i%3)] == 1) {
      gridBox.style.backgroundImage = "url('img/cross.svg')";
    }
    if (game.data[Math.floor(i/3)][Math.floor(i%3)] == 2) {
      gridBox.style.backgroundImage = "url('img/naught.svg')";
    }
    gameGrid.appendChild(gridBox);
    gridBox.onclick = updateFunc.bind(null,game.id,i);
  }
  document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
  var line1 = "Player 1: " + users[game.requestUser];
  let line2;
  if (game.accepted) {
    line2 = "Player 2: " + users[game.acceptUser];
  } else {
    line2 = "Awaiting player 2...";
  }
  let line3;
  if (game.turnNum % 2 == 0) {
    line3 = users[game.requestUser] + "'s Turn'";
  } else {
    if (game.accepted) {
      line3 = users[game.acceptUser] + "'s Turn'";
    } else {
      line3 = "Click a square to join as player 2!";
    }
  }

  if (game.won) {
    message.appendChild(document.createTextNode("Game over!"));
    message.appendChild(document.createElement("br"));
    message.appendChild(document.createTextNode(`Winner: ${users[game.winner]}`));
  } else {
    message.appendChild(document.createElement("br"));
    message.appendChild(document.createTextNode(line1));
    message.appendChild(document.createElement("br"));
    message.appendChild(document.createTextNode(line2));
    message.appendChild(document.createElement("br"));
    message.appendChild(document.createTextNode(line3));
  }
}

socket.on("gameStarted", (game) => {
  socket.emit("getUsers", (response)=>{
    users = response;
    if (loggedIn) {
      var message = document.createElement("div");
      message.classList.add("message");
      document.getElementById("messages").appendChild(message);
      createTicTacToeBoard(message,game);
    }
  });
});
socket.on("gameUpdate",(game) => {
  socket.emit("getUsers", (response)=>{
    users = response;
    if (loggedIn) {
      var gameContents = document.getElementById(`game-${game.id}`);
      var message = gameContents.parentElement;
      createTicTacToeBoard(message,game);
    }
  });
});

function sendMessage() {
  if (loggedIn) {
    var messageInput = document.getElementById("messageInput");
    socket.emit("sendMessage",messageInput.value,attachments, function(response) {
      if (response.success && response.data) {
        startedGames.push(response.data);
      }
    });
    messageInput.value = "";
    attachments = [];
    updateAttachments();
  }
}

document.getElementById("messageInput").addEventListener("keypress", function(event) {
  // If the user presses the "Enter" key on the keyboard
  if (event.key === "Enter") {
    // Cancel the default action, if needed
    event.preventDefault();
    // Trigger the button element with a click
    sendMessage();
  }
});

socket.on("forceRefresh", ()=>{ //Emitted when user doesn't exist
  alert("The Server Is Refreshing Due To An Error OR An Update Is Happening");
  location.reload(); //Refresh so they login again
});


function moreMenu() {
  //for now this just attatches an image, at one point it should also be able to:
  // - attatch a game of tic tac toe / 4 in a row / ect.
  // - quick slash command menu
  // - probably other stuff
  if (loggedIn) {
    document.getElementById("moreMenu").classList.toggle("open");
    //attachImage();
  }
}

function attachImage() {
  var input = document.createElement('input');
  input.type = 'file';

  input.onchange = e => { 
    var file = e.target.files[0]; 
    var reader = new FileReader();
    reader.onloadend = () => {
      // Use a regex to remove data url part
      const base64String = reader.result;
        //.replace('data:', '')
        //.replace(/^.+,/, '');
      attachments.push({"type":"image","data":base64String});
      updateAttachments();
    };
    reader.readAsDataURL(file);
  };

  input.click();
  document.getElementById("moreMenu").classList.remove("open");
}

function updateAttachments() {
  document.getElementById("attachments").innerHTML = "";
  if (attachments.length > 0) {
    document.getElementById("attachments").classList.add("attachmentsOpen");
    document.getElementById("messages").classList.add("attachmentsOpen");
  } else {
    document.getElementById("attachments").classList.remove("attachmentsOpen");
    document.getElementById("messages").classList.remove("attachmentsOpen");
  }
  for (var attachment of attachments) {
    switch(attachment.type) {
      case "image":
        var attachmentElement = document.createElement("img");
        attachmentElement.src = attachment.data;
        break;
      case "game":
        var attachmentElement = document.createElement("img");
        if (attachment.data == "tictactoe") {
          attachmentElement.src = "img/tictactoe.svg";
        }
        break;
      case "meme":
        var attachmentElement = document.createElement("img");
        attachmentElement.src = "img/more.png";
        break;
      default:
        var attachmentElement = document.createElement("img");
        attachmentElement.src = "img/more.png";
    }
    attachmentElement.classList.add("attachment");
    document.getElementById("attachments").appendChild(attachmentElement);
  }
}

function attachGame(game) {
  if (loggedIn) {
    var allowed = true;
    for (var attachment of attachments) {
      if (attachment.type == "game") {
        alert("Only one game can be started per message.");
        allowed = false;
      }
    }

    if (allowed) {
      attachments.push({
        type:"game",
        data: game
      });
      document.getElementById("moreMenu").classList.remove("open");
      updateAttachments();
    }
  }
}
