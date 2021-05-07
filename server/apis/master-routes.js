var express = require('express');
const { JwtConfiguration } = require('./jwt/JwtConfiguration.js');
var router = express.Router();
var cors = require('cors');

var chatController = require('./chat/chat_api.js');


router.use(cors());

router.post('/api/v1/create-room', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.create_room(req,res);
});
router.get('/api/v1/all-chatrooms/:user_id', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.fetch_all_chatrooms(req,res);
});
router.get('/api/v1/chatrooms/:chatroom_id', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.fetch_chatroom_id(req,res);
});
router.get('/api/v1/messages/:chatroom_id', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.fetch_messages(req,res);
});

router.post('/api/v1/send_message', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.send_message(req,res);
});
router.put('/api/v1/reset_unread_count', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.reset_unread_count(req,res);
});
router.put('/api/v1/delete_message', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.delete_message(req,res);
});
router.post('/api/v1/block_user', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.block_user(req,res);
});

router.post('/api/v1/unblock_user', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.unblock_user(req,res);
});

router.post('/api/v1/mute_notifications', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.mute_notifications(req,res);
});
router.post('/api/v1/clear_chat', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.clear_chat(req,res);
});
router.put('/api/v1/update_message', JwtConfiguration.authenticateJWT, function(req, res){
    return chatController.update_message(req,res);
});


WebApp.connectHandlers.use(router);

module.exports = router;

