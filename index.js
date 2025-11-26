const express = require("express"); // use express
const app = express(); // create instance of express
const server = require("http").Server(app); // create server
const io = require("socket.io")(server,{
  maxHttpBufferSize: 1e8
}); // create instance of socketio (for server-client communication)
const https = require('https');

app.use(express.static("public")); // use "public" directory for static files
server.listen(3000); // run server

var users = {};
var rooms = {};
var games = {};

var greetings = [
  "[USER] joined the room!",
  "A wild [USER] appeared!",
  "It's a bird! It's a plane! It's [USER]!",
];


var goodbyes = [
  "[USER] dipped.",
  "[USER] left.",
  "[USER] said their fairwells.",
  "[USER] vanished off the face of the earth."
];



class Game {
  constructor(type,requestUser,id,room) {
    this.id = id;
    this.type = type;
    this.requestUser = requestUser;
    this.acceptUser = null;
    this.accepted = false;
    this.turnNum = 0;
    this.room = room;
    this.won = false;
    this.winner = null;
    if (type == "tictactoe") {
      this.data = [[0,0,0],[0,0,0],[0,0,0]];
    }
  }
  accept(acceptUser) {
    this.acceptUser = acceptUser;
    this.accepted = true;
    io.to(this.requestUser).emit("gameAccepted",this.id);
  }
  turn(sender,data) { //UNFINISHED
    console.log(" ")
    if (!this.won) {
      if (((this.turnNum % 2 == 0) && (sender == this.requestUser)) || ((this.turnNum % 2 != 0) && (sender == this.acceptUser))) {
        if (this.type == "tictactoe") {
          if (this.data[data.row][data.column] == 0) {
            this.data[data.row][data.column] = (this.turnNum % 2) + 1;
            this.turnNum += 1;

            //win checking
            var win = false
            if (this.data[data.row][0] == this.data[data.row][1] && this.data[data.row][0] == this.data[data.row][2] && this.data[data.row][0] > 0) {
              //Full row win
              win = true
            }
            if (this.data[0][data.column] == this.data[1][data.column] && this.data[0][data.column] == this.data[2][data.column] && this.data[0][data.column] > 0) {
              //Full column win
              win = true
            }
            if (this.data[0][0] == this.data[1][1] && this.data[0][0] == this.data[2][2] && this.data[0][0] > 0) {
              //TL-BR diagonal win
              win = true
            }
            if (this.data[0][2] == this.data[1][1] && this.data[0][2] == this.data[2][0] && this.data[0][2] > 0) {
              //TR-BL diagonal win
              win = true
            }

            if (win) {
              //PUT SMTH HERE
              this.won = true;
              if (this.data[data.row][data.column] == 1) {
                this.winner = this.requestUser;
              } else {
                this.winner = this.acceptUser;
              }
            }

          }
        }
      }
      io.in(this.room).emit("gameUpdate",this);
    }
  }
  close() {
    io.in(this.room).emit("gameClosed",this.id);
    delete games[this.id];
  }
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function getRequest(url,callback) {
  https.get(url, res => {
    let rawData = ''

    res.on('data', chunk => {
      rawData += chunk
    })

    res.on('end', () => {
      callback(rawData);
    });

  });
}

function censor(text,callback) {
  if (/\s/.test(text) || text.length == 0) {
    callback(text);
  } else {
    getRequest("https://www.purgomalum.com/service/plain?text="+text, (response)=>{
      callback(response);
    });
  }
}



io.on("connection", socket => {

  socket.on("connecting", () => { // when a client connects
    io.emit("connected",socket.id); // inform all clients that a new client has connected
  });

  socket.on("disconnect", () => { // when someone closes the tab
    if (users[socket.id] && rooms[socket.id]) {
      io.in(rooms[socket.id]).emit("serverMessage",goodbyes[Math.floor(Math.random()*goodbyes.length)].replace("[USER]",users[socket.id]),"leave.png");
    }
    delete users[socket.id];
    delete rooms[socket.id];

    for (var game of Object.values(games)) {
      if (game.requestUser == socket.id) {
        game.close();
      }
    }
    io.emit("disconnected",socket.id); // inform all clients that a client has disconnect
  });

  socket.on("login", (username, callback) => {
    censor(username, (censoredUsername) => {
        var username = censoredUsername;
        username = username.trim();
        username = replaceAll(username,"<","&lt;");
        username = replaceAll(username,">","&gt;");        

        if (Object.keys(users).includes(socket.id)) {
          callback({success:false,cause:"Already logged in"});
        } else if (username.length < 4 == username.length < 17) {
          callback({success:false,cause:"Username too Short/Long"});
        } else if (Object.values(users).includes(username)) {
          callback({success:false,cause:"Username taken"});
        } else {
          users[socket.id] = username;
          callback({success:true});
          socket.join("main");
          rooms[socket.id] = "main";
          io.in("main").emit("serverMessage",greetings[Math.floor(Math.random()*greetings.length)].replace("[USER]",username),"join.png");
        }
      });
  });

  socket.on("sendMessage",(message,attachments,callback) => {
    //xss protection
    message = replaceAll(message,"<","&lt;");
    message = replaceAll(message,">","&gt;");
    message = replaceAll(message,"#","%23")
    message = replaceAll(message,"room/","%23")
    message = replaceAll(message,"i9","%21")

    if (users[socket.id]) {
      var length = message.length + attachments.length
      if (length > 0 && length <= 256) {
        var gameStarted = null;
        for (var attachment of attachments) {
          console.log(attachment);
          if (attachment.type == "game") {
            if (!gameStarted) {
              var gameID = Date.now();
              games[gameID] = new Game(attachment.data,socket.id,gameID,rooms[socket.id]);
              gameStarted = gameID;
            }
          } else if (attachment.type == "meme") {
            randomMeme((response) => {
              io.in(rooms[socket.id]).emit("meme",response);
            });
          }
        }
        censor(message,(message)=> {
          io.in(rooms[socket.id]).emit("message",users[socket.id],message,attachments);
          if (gameStarted) {
            io.in(games[gameStarted].room).emit("gameStarted",games[gameStarted]);
          }
          callback({success:true,data:gameStarted});
        });
      }
    } else {
      socket.emit("forceRefresh");
    }
  });

  socket.on("joinRoom",(room) => {
    if (users[socket.id]) {
      for (var game of Object.values(games)) {
        if (game.requestUser == socket.id) {
          game.close();
        }
      }
      io.in(rooms[socket.id]).emit("serverMessage",goodbyes[Math.floor(Math.random()*goodbyes.length)].replace("[USER]",users[socket.id]),"leave.png");
      socket.leave(rooms[socket.id]);
      io.to(socket.id).emit("serverMessage",`ROOM: ${room}`);
      rooms[socket.id] = room;
      socket.join(room);
      io.in(rooms[socket.id]).emit("serverMessage",greetings[Math.floor(Math.random()*greetings.length)].replace("[USER]",users[socket.id]),"join.png");
    } else {
      socket.emit("forceRefresh");
    }
  });

  socket.on("updateGame",(gameID,data) => {
    if (users[socket.id]) {
      console.log(`Update game ID "${gameID}" with data "${data}"`);
      if (games[gameID]) {
        var game = games[gameID];
        if (socket.id == game.requestUser || socket.id == game.acceptUser || (game.accepted == false && (game.turnNum % 2 == 1) && socket.id != game.requestUser)) {
          if (game.accepted == false && (game.turnNum % 2 == 1) && socket.id != game.requestUser){
            game.accepted = true;
            game.acceptUser = socket.id;
          }

          if (game.type == "tictactoe") {
            game.turn(socket.id,{row:Math.floor(data/3),column:Math.floor(data%3)});
          }
        }
      }
    }
  });

  socket.on("getUsers",(callback) => {
    callback(users);
  });

});

