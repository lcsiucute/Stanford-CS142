import * as React from "react";
import { Link } from "react-router-dom";
import { List, ListItem, ListItemText } from "@material-ui/core";
import "./userList.css";
import axios from "axios";

/**
 * * Jian Zhong
 * Define UserList, a React componment of CS142 project #5
 * Generate a list of items from users' names,
 * and link to user's detail when clicked
 */
class UserList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      users: null,
    };
    this.url = "http://localhost:3000/user/list"; // user list URL
    this.source = axios.CancelToken.source();
  }
  
   // Use Axios to send request and update the users state variable. 
  fetchData() {
    /**
     * * Only show user lsit when login
     */
    if (this.props.loginUser) {
      axios
        .get(this.url, { cancelToken: this.source.token }) // returning a promise
        .then(response => { // Handle success
          this.setState({ users: response.data });
          console.log("** Finish setting User List !**");
        })
        .catch(error => {     // Handle error
          console.log(`** Error: ${error.message} **\n`);
          if (axios.isCancel(error)) {
            console.log('Request canceled', error.message);
          } else if (error.response) {
            // if status code from server is out of the range of 2xx.
            console.log("** Error: status code from server is out of the range of 2xx. **\n", error.response.status);
          } else if (error.request) {
            // if request was made and no response was received.
            console.log("** Error: request was made and no response was received. **\n", error.request);
          } else {
            // something happened in the setting up the request
            console.log("** Error: something happened in the setting up the request. **\n", error.message);
          }
        });
    }
  }
  
  // load user list when page first load or user refreash
  componentDidMount() {
    /**
     * * Only show user lsit when login, 
     * * otherwise don't fetch data.
     */
    if (this.props.loginUser) {
      this.fetchData();
    }
  }

  // to populate user list on side bar once the user logs in
  componentDidUpdate(prevProps) {
    /**
     * * Detect if user loggin status changes
     */
    if (this.props.loginUser !== prevProps.loginUser) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this.source.cancel("Request cancelled by user");
  }

  render() {
    let userList; // <Link> component

    // The user list only display if the current user is logged in
    if (this.state.users && this.props.loginUser) {
      userList = this.state.users.map(user => (
        <ListItem
          to={`/users/${user._id}`}
          component={Link}
          key={user._id}
          divider
          button
        >
          {/* Link's to must be direct link address */}
          <ListItemText primary={user.first_name + " " + user.last_name} />
        </ListItem>
      ));
    }

    return <List component="nav">{userList}</List>;
  }
}

export default UserList;