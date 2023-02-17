/* jshint node: true */

/*
 * This builds on the webServer of previous projects in that it exports the current
 * directory via webserver listing on a hard code (see portno below) port. It also
 * establishes a connection to the MongoDB named 'cs142project6'.
 *
 * To start the webserver run the command:
 *    node webServer.js
 *
 * Note that anyone able to connect to localhost:portNo will be able to fetch any file accessible
 * to the current user in the current directory or any of its children.
 *
 * This webServer exports the following URLs:
 * /              -  Returns a text status message.  Good for testing web server running.
 * /test          - (Same as /test/info)
 * /test/info     -  Returns the SchemaInfo object from the database (JSON format).  Good
 *                   for testing database connectivity.
 * /test/counts   -  Returns the population counts of the cs142 collections in the database.
 *                   Format is a JSON object with properties being the collection name and
 *                   the values being the counts.
 *
 * The following URLs need to be changed to fetch there reply values from the database.
 * /user/list     -  Returns an array containing all the User objects from the database.
 *                   (JSON format)
 * /user/:id      -  Returns the User object with the _id of id. (JSON format).
 * /photosOfUser/:id' - Returns an array with all the photos of the User (id). Each photo
 *                      should have all the Comments on the Photo (JSON format)
 */

/**
 * Setup Mongoose database and connect:
 */
var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
mongoose.connect('mongodb://localhost/cs142project6', { useNewUrlParser: true, useUnifiedTopology: true });

/**
 * Setup necessary parsers middlewares:
 *  */ 
const session = require('express-session'); // for handling session management
const bodyParser = require('body-parser');  // for parsing the JSON encoded POST request bodies
const multer = require('multer');           // for handling uploading files.
var MongoStore = require('connect-mongo')(session);


/**
 *  Setup ExpressJS App
 *  */
var express = require('express');
var app = express();   
var async = require('async'); // to use async.each()


// Load the Mongoose schema for User, Photo, and SchemaInfo
var User = require('./schema/user.js');
var Photo = require('./schema/photo.js');
var SchemaInfo = require('./schema/schemaInfo.js');


// We have the express static module (http://expressjs.com/en/starter/static-files.html) 
// do all the work for us.
app.use(express.static(__dirname));
/**
 * The __dirname is a global variable that represents the directory name of the current module.
 * So, when a client makes a request for a file, the Express application will check the current 
 * directory for the file and return it to the client if it exists. 
 */


/**
 * * Jian Zhong: Project 7, Setup Express Session
 * Setup Session Store
 * use the MongoStore for storaging Session
 */
app.use(session({
    secret: 'secretKey', 
    resave: false, 
    saveUninitialized: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection })
})); 

app.use(bodyParser.json());  // parse application/json


/**
 * * Jian Zhong: Project 7, API for loggging in a user
 * Provides a way for the photo app's LoginRegister view to login in a user
 */
app.post('/admin/login', (request, response) => {
    /**
     * See if the request's loginName matches database
     * if match, send back greeting to client
     * if not match, send 400 status code(Bad Request).
     */
    User.findOne({ login_name: request.body.login_name })
        .then(user => {
            // Login name NOT exists, response status 400 and info "Login name is not a valid account"
            if (!user) {
                response.status(400).send("Status: 400, Login name is NOT found.");
            } else {
            // Login name exists, reply with information for logged in user
                const userObj = JSON.parse(JSON.stringify(user)); // * convert mongoose data to JS data, needed for retrieving data from Mongoose!
                request.session.userRecord = userObj._id;          // save login user id to session
                response.status(200).json({ first_name: userObj.first_name, _id: userObj._id }); // reply back with first name of the user                
                /**
                 * * Why can't send object below as a response?
                 * * { first_name: user.first_name, lastName: user.last_name }
                 * * Answer: you didn't user "JSON.parse(JSON.stringify(user))" to convert data before sending out.
                 */
            }
        })
        .catch(error => {
            console.error(`** Error occured: ${error}. **`);
        });
});


/**
 * * Jian Zhong: Project 7, API for logging out in a user
 * A POST request with an empty body to this URL will logout the user by clearing the information stored in the session. 
 * An HTTP status of 400 (Bad request) should be returned in the user is not currently logged in
 */
app.post('/admin/logout', (request, response) => {
    // return status code 400 if user is currently not logged in
    if (!request.session.userRecord) {
        response.status(400).send({error: "User is not logged in"});
        console.log("You already logged out, no need to do again.");
    } else {
        // clear the information stored in the session
        request.session.destroy(err => {

        // return status code 400 if error occurs during destroying session
        if (err) {
            response.sendStatus(400);
            console.log("Error in destroying the session");
        }
        else {
            // Delete session successfully, send 200 code!
            response.sendStatus(200);
            console.log("OK");
        }
     });
    }
});


/**
 * * Jian Zhong: Project 7
 * * Function to check if the user is logged,
 * * only logged user can continue next step.
 * @param request 
 * @param response 
 * @param next 
 */
function isAuthenticated(request, response, next) {
    if (request.session.userRecord) {
        console.log("Authenticattion Passes.");
        next();
    }
    else {
        console.log("Authenticattion Failed.");
        response.status(401).json({ message: 'Unauthorized' });
        // ! You forgot to send the status, .json() or .send() neeed.
    }
}


app.get('/', isAuthenticated, function (request, response) {
    console.log('Simple web server of files from ' + __dirname);
    response.send('Simple web server of files from ' + __dirname);
});


/*
 * Use Express to handle argument passing in the URL.  This .get will cause express
 * To accept URLs with /test/<something> and return the something in request.params.p1
 * If implement the get as follows:
 * /test or /test/info - Return the SchemaInfo object of the database in JSON format. This
 *                       is good for testing connectivity with  MongoDB.
 * /test/counts - Return an object with the counts of the different collections in JSON format
 */
app.get('/test/:p1', isAuthenticated, function (request, response) {
    // Express parses the ":p1" from the URL and returns it in the request.params objects.
    var param = request.params.p1 || 'info';

    if (param === 'info') {
        // Fetch the SchemaInfo. There should only one of them. The query of {} will match it.
        SchemaInfo.find({}, function (err, info) {
            if (err) {
                // Query returned an error.  We pass it back to the browser with an Internal Service
                // Error (500) error code.
                console.error('Doing /user/info error:', err);
                response.status(500).send(JSON.stringify(err));
                return;
            }
            if (info.length === 0) {
                // Query didn't return an error but didn't find the SchemaInfo object - This
                // is also an internal error return.
                response.status(500).send('Missing SchemaInfo');
                return;
            }

            // We got the object - return it in JSON format.
            console.log('SchemaInfo', info[0]);
            response.end(JSON.stringify(info[0]));
        });
    } else if (param === 'counts') {
        // In order to return the counts of all the collections we need to do an async
        // call to each collections. That is tricky to do so we use the async package
        // do the work.  We put the collections into array and use async.each to
        // do each .count() query.
        var collections = [
            {name: 'user', collection: User},
            {name: 'photo', collection: Photo},
            {name: 'schemaInfo', collection: SchemaInfo}
        ];
        async.each(collections, function (col, done_callback) {
            col.collection.countDocuments({}, function (err, count) {
                col.count = count; // adding count property into collections's element
                done_callback(err);
            });
        }, function (err) {
            if (err) {
                response.status(500).send(JSON.stringify(err));
            } else {
                var obj = {};  // count obj
                for (var i = 0; i < collections.length; i++) {
                    obj[collections[i].name] = collections[i].count; 
                    // assign each count value into the count obj
                }
                response.end(JSON.stringify(obj));
            }
        });
    } else {
        // If we know understand the parameter we return a (Bad Parameter) (400) status.
        response.status(400).send('Bad param ' + param);
    }
});


/*
 * Jian Zhong
 * URL /user/list - Return all the User object.
 */

/**
 * ! solved wating for /user/list response forever:
 * ! because of isAuthenticated() middleware,
 * ! requst to this path will hang forever.
 */
app.get('/user/list', isAuthenticated ,function (request, response) {

    User.find({}, function(err, users) {
        // Error handling
        if (err) {
            console.log("** Get user list: Error! **");
            response.status(500).send(JSON.stringify(err));
        } else {
            /**
             * "user" returned from Mongoose is Array type: Array of user objects.
             * also need to be processed as Mongoose models and models from frontend do not allign perpectly.
             */
            console.log("** Read server path /user/list Success! **");
            const userList = JSON.parse(JSON.stringify(users));    // convert Mongoose data to Javascript obj
            
            /**
             * * non-async method
             * Get only wanted user proeprties from Database's model, 
             * and construct a new users obj to response.
             */
            const newUsers = userList.map(user => {
                const { first_name, last_name, _id } = user;
                return { first_name, last_name, _id };
            });

            // Send response to client
            response.json(newUsers);            

            /**
             * * async method with "async.each()"
             */
            // const newUserList = [];
            // async.each(userList, (user, doneCallback) => {
            //     const { first_name, last_name, _id } = user;
            //     newUserList.push({ first_name, last_name, _id }); 
            //     doneCallback(err);
            //     console.log("From async: ", newUserList);
            // }, error => {
            //     if (error) {
            //         console.log(error);
            //     } else {
            //         response.json(newUserList);
            //     }
            // });
        }
    });

});


/*
 * Jian Zhong
 * URL /user/:id - Return the information for User (id)
 */
app.get('/user/:id', isAuthenticated, function (request, response) {
    const id = request.params.id;

    /**
     * Finding a single user from user's ID
     */
    User.findOne({_id: id}, function(err, user) {
        if (err) {          // data not found
            console.log(`** User ${id}: Not Found! **`);
            response.status(400).send(JSON.stringify(err));
        } else {            // found data!
            const userObj = JSON.parse(JSON.stringify(user)); // convert mongoose data to JS data
            console.log(`** Read server path /user/${id} Success! **`);
            delete userObj.__v;                               // remove unnecessary property
            response.status(200).json(userObj);
        }
    });
});


/**
 * * Jian Zhong 
 * * URL /photosOfUser/:id - Return the Photos for User (id)
 */
app.get('/photosOfUser/:id', isAuthenticated, function (request, response) {
    var id = request.params.id;

    /**
     * Finding a single user from user's ID
     */
    Photo.find({user_id: id}, (err, photos) => {
        if (err) {
            console.log(`** Photos for user with id ${id}: Not Found! *`);
            response.status(400).send(JSON.stringify(`** Photos for user with id ${id}: Not Found **`));
        } else {
            console.log(`** Read server path /photosOfUser/${id} Success! **`);
            let count = 0;                                        // count the number of processed photos 
            const photoList = JSON.parse(JSON.stringify(photos)); // get data from server and convert to JS data

            // For each photo in photos list:
            photoList.forEach(photo => {
                delete photo.__v;  // remove the unnessary property before sending to client.

                // For each comment in comments list: 
                /**
                 * * To fecth multiple modules, need to use async.each().
                 */
                async.eachOf(photo.comments, (comment, index, callback) => {
                    // Use comment's user_id to get user object and update comment's user property.
                    User.findOne({_id: comment.user_id}, (error, user) => {
                        if (!error) {
                            const userObj = JSON.parse(JSON.stringify(user)); // parse retrieved Mongoose user data
                            const {location, description, occupation, __v, ...rest} = userObj; // only keep (_id, first_name, last_name) properties
                            photo.comments[index].user = rest;      // update the user obj to each comment's user property.
                            delete photo.comments[index].user_id;   // remove unnessary property for each comment
                        }
                        callback(error);
                    });
                }, error => {
                    count += 1;
                    if (error) {
                        response.status(400).send(JSON.stringify(`** Photos for user with id ${id}: Not Found **`));
                    } else if (count === photoList.length) {
                        // Response to client only after aysnc.each() has processed all Photos in photoList.
                        console.log("Done all  async() processing");
                        response.json(photoList);  // Response to client, finanly!
                    }
                }); // end of "async.eachOf(photo.comments,)"
            }); // end of "photoList.forEach(photo)"

        }
    });    
});




var server = app.listen(3000, () => {
    var port = server.address().port;
    console.log('Listening at http://localhost:' + port + ' exporting the directory ' + __dirname);
});
