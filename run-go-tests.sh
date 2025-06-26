#!/bin/bash
set -e

run_and_report() {
  local dir="$1"
  echo "Running Go unit tests in $dir..."
  cd "$dir"
  output=$(go test -v ./... | tee /dev/tty)
  total=$(echo "$output" | egrep '^--- (PASS|FAIL):' | wc -l | tr -d ' ')
  passed=$(echo "$output" | egrep '^--- PASS:' | wc -l | tr -d ' ')
  if [ "$total" -eq 0 ]; then
    ok_lines=$(echo "$output" | grep '^ok' | wc -l | tr -d ' ')
    if [ "$ok_lines" -gt 0 ]; then
      echo "All tests passed in $dir (cached). ✅"
    else
      echo "No tests found in $dir."
    fi
  elif [ "$total" -eq "$passed" ]; then
    echo "$passed/$total test cases passed in $dir. ✅"
  else
    echo "$passed/$total test cases passed in $dir. ❌"
    exit 1
  fi
  cd ..
}

run_and_report telemetry-api
run_and_report telemetry-generator

echo "All Go unit tests completed." 