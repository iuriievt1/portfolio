# Portfolio

Hi, I'm Iurii, a full-stack developer from Prague. I mostly write TypeScript: React Native and Expo on mobile, React and Next.js on the web, Node.js and NestJS on the server, with PostgreSQL underneath.

Every folder here is a separate project.

## Medical Platform

An app for hospital nurses. They photograph wounds and scan paper documents on a phone, and the server sends everything to the hospital image archive as DICOM. Staff sign in with a card or a QR code, uploads are encrypted on the device, and scanned pages go through OCR before they become a PDF. The hospital team manages users, devices and deliveries in a web admin.

Mobile app in React Native and Expo, server in NestJS with a separate API and background worker, admin in React and Vite, PostgreSQL, FHIR through Medplum. Nx monorepo.

## Wildberys

A marketplace for Czechia and the EU, still in progress. It has a web store for buyers, a mobile app, a portal for sellers with registration and moderation, and an admin panel for the team.

NestJS, Prisma, PostgreSQL and Redis on the server, Next.js and React on the web, Expo with NativeWind on mobile. Turborepo monorepo.

## Streaming Platform MK

A web app for a live TV and video streaming service: the Next.js app, a shared design system and a data layer on top of the streaming API.

Next.js, React, TanStack Query, Tailwind CSS, Zod and Vitest in an Nx monorepo.

## Streaming Platform BF

A live TV and video on demand app for phones and tablets.

React Native and Expo Router, Bitmovin player with DRM, TanStack Query, Zustand, NativeWind, Sentry, feature flags with Featurevisor, Storybook and Jest.

## loftn8app

Ordering system for a restaurant and hookah lounge with three venues in Prague. Guests order from the table through a QR code, and the staff get each order split for the kitchen, the bar and the hookah zone.

Next.js, Express, Prisma, PostgreSQL, Docker and Caddy.

## otpbank

A banking app I built for my portfolio: customer app, backoffice for admins and support, double-entry ledger and transfers that can't go through twice.

Next.js, NestJS, Prisma, PostgreSQL, Redis.

## vybe_v1

MVP of a geo-social app for Prague. People post what's going on at a place right now, with photos, how crowded and how loud it is.

NestJS, Next.js, PostgreSQL.

## ClientPortal

Portal for folders, documents and files, with a web app and a mobile app on the same API.

Next.js, Expo, Prisma.

## artcitcgrp

Website for a home construction and design company.

Plain HTML, CSS and JavaScript.
