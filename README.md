# waggoner-house-firebase-proxy

## Install
```
git clone <url>
cd waggoner-house-firebase-proxy
sudo cp waggoner-house-firebase-proxy.service /etc/systemd/system // Change User and ExecStart path to the correct username
mkdir secrets
scp ./secrets/waggoner-house-firebase-service-account.json chip@chip.local:~/waggoner-house-firebase-proxy/secrets/ // On local machine
// Install Node: https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions
```

## Run
```
sudo systemctl restart waggoner-house-firebase-proxy
```

## Check Status
```
sudo systemctl status waggoner-house-firebase-proxy
sudo systemctl restart waggoner-house-firebase-proxy && sudo journalctl -u waggoner-house-firebase-proxy -f
journalctl -u waggoner-house-firebase-proxy
journalctl -u waggoner-house-firebase-proxy -f
```
