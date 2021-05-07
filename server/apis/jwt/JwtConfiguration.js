
var jwt = require("jsonwebtoken");  
import {User} from './../../../collections/collection.js';


export class JwtConfiguration {
  static tokenSecret = "METEOR_youraccesstokensecret_METEOR";

  static encryptPass(textToEncode) {
    var assert = require("assert");
    var crypto = require("crypto");
    var Buffer = require("buffer").Buffer;
    var SECRET_KEY = "ChuckN0rrisL1kesPur3D3PapaSuperKey";
    var ENCODING = "hex";
    var text = textToEncode;
    var cipher = crypto.createCipher("des-ede3-cbc", SECRET_KEY);
    var cryptedPassword = cipher.update(text, "utf8", ENCODING);
    cryptedPassword += cipher.final(ENCODING);
    return cryptedPassword;
  }
  static accessTokenSecret() {
    return JwtConfiguration.tokenSecret;
  }

  static authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const token = authHeader.split(" ")[1];

      jwt.verify(token, JwtConfiguration.tokenSecret, (err, user) => {
        if (err) {
          return res.status(200).json({ code: 403, message: "Token Expired" });
        }

        req.user = user;
        next();
      });
    } else {
      res.status(200).json({ code: 403, message: "Not Authorized" });
    }
  };
  static authenticateJWTwithUser = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const token = authHeader.split(" ")[1];

      jwt.verify(token, JwtConfiguration.tokenSecret, (err, user) => {
        if (err) {
          return res.status(200).json({ code: 403, message: "Token Expired" });
        }
        var user_id = req.headers.user_id;

        let checkForValidUser = User.find({
          user_id: user_id,
        }).count();
        // console.log("Checking User");
        if (checkForValidUser == 0) {
          return res.status(200).send({
            code: 403,
            message: "Bad User",
          });
        }
        req.user = user;
      
        next();
      });
    } else {
      res.status(200).json({ code: 401, message: "Not Authorized" });
    }
  };
}
