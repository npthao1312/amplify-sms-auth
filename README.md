# Phone OTP Authentication using AWS Amplify, Cognito & Lambda

## AWS Cognito - Create User Pool 
### Attributes
- Choose "Email address or Phone number".
- Choose "Allow Phone numbers".

### Policies
- Choose "Allow users to sign themselves up".

### MFA and Verifications
- Choose "Off".
- Choose "None – users will have to contact an administrator to reset their passwords"
- Choose "No Verification"

### App Clients
- Click "Add an App Client". 
- Uncheck "Generate Client Secret".
- Choose "Enable lambda trigger-based custom authentication".

### Triggers 
Create lambda triggers then comeback to this section later. 

## Lambda Custom Authentication Flow
1. User will enter the phone number, and click Login.
2. User pool will receive the phone number, it will then call the “Define Auth Challenge” lambda. This lambda is responsible to drive the entire authentication flow. It determines which custom challenge needs to be created. In our case, the custom challenge will be to send and verify OTP.
3. User pool will then call “Create Auth Challenge” lambda function. This lambda will generate a OTP and sends it as an SMS.
4. User will then retrieve and enter the OTP.
5. User pool will then call “Verify Auth Challenge” lambda function. This lambda is responsible to check if the OTP user has entered is correct or not.
6. User pool will then again call “Define Auth Challenge” to check whether the user has completed all the challenge. In case of Multi-factor authentication there will be multiple challenges.
7. Once all the challenges are completed, user will be logged in successfully. 

### Pre Sign Up
This lambda function is responsible to auto confirm and auto verify phone number during sign up.
```
exports.handler = async (event) => {
    event.response.autoConfirmUser = true;
    event.response.autoVerifyPhone = true;
    return event;
};
```

### Define Auth Challenge
Define the authentication flow. 
1. Check if user is registered? Throw error if user does not exist. 
2. Create a session array that will have the details of all the challenges and its result.
3. If the session array is empty, it means the authentication flow has just begun. Then we will present the “CUSTOM_CHALLENGE“.
4. If the session array is not empty, it means the user has answered the challenge and their answer is validated to be right or wrong. The validation result will be present in challengeResult field.
5. If answer is wrong, we will provide the same challenge once again. This way we will give the user 3 chances to enter the correct OTP. If wrong OTP is entered in all 3 attempts we will close the session and return an error.
6. If the OTP is correct, we will login the user and issue the authentication tokens.

```
exports.handler = async (event, context, callback) => {
    console.log(event.request);
    
    // If user is not registered
    if (event.request.userNotFound) {
        event.response.issueToken = false;
        event.response.failAuthentication = true;
        throw new Error("User does not exist");
    }
    
    if (event.request.session.length >= 3 && event.request.session.slice(-1)[0].challengeResult === false) { // wrong OTP even After 3 sessions?
        event.response.issueToken = false;
        event.response.failAuthentication = true;
        throw new Error("Invalid OTP");
    } else if (event.request.session.length > 0 && event.request.session.slice(-1)[0].challengeResult === true) { // Correct OTP!
        event.response.issueTokens = true;
        event.response.failAuthentication = false;
    } else { // not yet received correct OTP
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
        event.response.challengeName = 'CUSTOM_CHALLENGE';
    }
    
    return event;
};
```

### Create Auth Challenge
This lambda function is responsible to generate the OTP and send it as an SMS.

```
const AWS = require('aws-sdk');

function sendSMS(phone, code) {
    const params = {
      Message: code, /* required */
      PhoneNumber: phone,
    };
    
    return new AWS.SNS({apiVersion: '2010-03-31'}).publish(params).promise();
}

exports.handler = async (event) => {
    console.log("CUSTOM_CHALLENGE_LAMBDA", event.request);
    
    let secretLoginCode;
    if (!event.request.session || !event.request.session.length) {

        // Generate a new secret login code and send it to the user
        secretLoginCode = Date.now().toString().slice(-4);
        try {
            await sendSMS(event.request.userAttributes.phone_number, secretLoginCode);
        } catch {
           // Handle SMS Failure   
        }
    } else {

        // re-use code generated in previous challenge
        const previousChallenge = event.request.session.slice(-1)[0];
        secretLoginCode = previousChallenge.challengeMetadata.match(/CODE-(\d*)/)[1];
    }
    
    console.log(event.request.userAttributes);
    
    // Add the secret login code to the private challenge parameters
    // so it can be verified by the "Verify Auth Challenge Response" trigger
    event.response.privateChallengeParameters = { secretLoginCode };

    // Add the secret login code to the session so it is available
    // in a next invocation of the "Create Auth Challenge" trigger
    event.response.challengeMetadata = `CODE-${secretLoginCode}`;
    
    return event;
};
```

### Verify Auth Challenge
This lambda function is responsible to check if the OTP entered by the user is correct or not.

```
exports.handler = async (event) => {
    console.log(event.request);
    
    const expectedAnswer = event.request.privateChallengeParameters.secretLoginCode; 
    if (event.request.challengeAnswer === expectedAnswer) {
        event.response.answerCorrect = true;
    } else {
        event.response.answerCorrect = false;
    }
    
    return event;
};
```

## Amplify App Clients 
### Install AWS Amplify CLI
AWS Amplify CLI is a toolchain that allows you to create and manage AWS resources created for our application. In this case, it will help you to create and manage AWS Cognito User Pools and Authentication APIs.

```
npm install -g @aws-amplify/cli

```

### Configuring AWS Amplify CLI
Create a new IAM user or use the available access and secret token. 
```
amplify configure
```

### Create New React App
Create a fresh React application using `create-react-app`.
```
npx create-react-app amplify-sms-auth
cd amplify-sms-auth
```

### Add Amplify to your Application
To add amplify to your application run the following command from your application’s root directory. Just follow the default wizard. 
```
amplify init
```

### Import the above Cognito User Pool 

```
amplify import auth
```
- Select "User Pool only". 
- Import the needed user pool. 

Run `amplify push` to complete the import procedure.

Once it has finished creating the cloud resources, it will output the hosted UI URL and also update the `aws-exports.js` file with the metadata for newly created resources.

### Add Amplify Libraries to the Application
To call AWS Amplify service from your application you need the AWS Amplify libraries for JavaScript and React. You can install them by running the following command:

```
yarn add aws-amplify aws-amplify-react
```

You need to provide a config to Amplify library, we can do it by passing in the configuration from aws-exports.js to Amplify.configure method like so:
```
index.js

import Amplify from 'aws-amplify';
import config from './aws-exports.js';

Amplify.configure(config);
```

### Protecting React Components
Let’s assume the contents of the App component is to be protected with authentication. Then all you need to do is wrap the App component in `withAuthenticator` HOC provided by `aws-amplify-react` package.

```
import {
  withAuthenticator,
} from "aws-amplify-react";

function App() {
  return <div className="App"></div>;
}

const signUpConfig = {
  header: "Create an Account",
  hideAllDefaults: true,
  defaultCountryCode: "1",
  signUpFields: [
    {
      label: "Phone number",
      key: "username",
      required: true,
      displayOrder: 1,
      type: "string",
    },
    {
      label: "Password",
      key: "password",
      required: true,
      displayOrder: 2,
      type: "password",
    },
  ],
};

export default withAuthenticator(App, {
  includeGreetings: true,
  signUpConfig,
});
```

Now `yarn start`. And open at `localhost:3000`.
