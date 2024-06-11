#!/bin/bash

# Loop 2000 times
for ((i=1; i<=2000; i++))
do
  # Send POST request to http://localhost:3000/api/request with random data
  curl -X POST -H "Content-Type: application/json" -d "{\"requestMessage\": \"Request $i\", \"functionName\": \"handleData\"}" http://localhost:3000/api/request &
done

wait
echo "All requests sent"
