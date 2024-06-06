// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

function handler(event) {
    var request = event.request;
    var format = 'jpeg';
    var quality = 70; // TODO change to the desired value
    if (request.headers['accept']) {
        if (request.headers['accept'].value.includes("webp")) {
            format = 'webp';
        } 
    }

    request.uri = request.uri + `/format=${format},quality=${quality}` ;
    return request;
}
