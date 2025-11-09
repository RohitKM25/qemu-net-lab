# Qemu Network Lab

- Front-end: NextJS
- Back-end: ExpressJS
- Virtualization: QEMU
- Remote Console: Guacamole

## Getting Started

### Prerequisites

- docker
- docker-compose

### Setup
  
- By default [Alpine Linux NoCloud Tiny](https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/nocloud_alpine-3.22.2-x86_64-bios-tiny-r0.qcow2) is used as the base image.
  To use your own image, create `./images` folder, and add your image in qcow2 format as `base.qcow2`.
- then run,
  ```
  docker compose up
  ```
- Access the
  - Web app at `http://localhost:3001`
  - Backend REST API at `http://localhost:3000`
  - Guacamole Website at `http://localhost:8080`
- For Guacamole connections, no dedicated users (if required configure properties file) otherwise use as administrator
  ```
  Username: guacadmin
  Password: guacadmin
  ```
- The default image is not configured, hence it will boot up to the tty login. Username: `alpine`, Password: Not Set (For cloud image,
  to be set with ssh key from Alpine website).
  This image is for testing, not usable after the tty login. Requires setup.
