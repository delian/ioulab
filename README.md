# Network Lab Diagraming Tool

## Objective

The goal of this project is to create a real time HTML5 network lab diagraming tool for Labs and training.
The tool is supposed to be used with "terminal" access interface to software or devices

## Installation

You need mongo db and node at least version 0.10 preinstalled.

After git clone, you should go in the network directory and do 'npm install' to install the module dependencies:

    npm install

To start the application do:

    npm start
    
To access the web interface, start a browser and connect it to http://127.0.0.1:3000/ui/app.html

## Developing


## Bugs

-- Socket.IO on the client side does not destroy/disconnect itself for some reason

-- Socket.IO on the Node.JS side gets into a forever loop
