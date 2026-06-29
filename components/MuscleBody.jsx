'use client'
/*
 * MuscleBody — loads one of four GLB models and overlays muscle hitboxes.
 *
 * Camera behavior is Persona 5-style:
 *   - Auto-rotates slowly at the overview when nothing is selected
 *   - Clicking a muscle zooms and pans the camera to that body part
 *   - Switching muscles zooms out to overview first, then pans in to the new one
 *   - Clicking the background zooms back out to overview
 *   - No bubble overlays — selected muscles glow with additive blending
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Center, OrbitControls, TransformControls } from '@react-three/drei'
import { Suspense, useRef, useState, useMemo, useEffect, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { useSound } from '../lib/useSound'

// Preload all four models so switching between them is instant
useGLTF.preload('/models/goku.glb')
useGLTF.preload('/models/super_saiyan_goku_rigged.glb')
useGLTF.preload('/models/gohan.glb')
useGLTF.preload('/models/muscle_body_rigged.glb')

const TARGET_HEIGHT = 4.0

// Debug overlay — toggled at runtime with the backtick (`) key.
// When on: colored wireframe gizmos + OrbitControls replace the P5 camera.
// F12 snapshots all current hitbox transforms to console (code-paste format
// + JSON training record).
// Default off — no source change needed to enter calibration mode.

const MODELS = {
  goku: {
    path: '/models/goku.glb',
    rotationY: Math.PI,
    scaleMult: 1.0,
    // Bone-derived hitboxes (T-pose arms horizontal → sx is the long arm dimension).
    // Bone anchors: Spine2=[0,1.145,0.084] Shoulder=±0.223,1.401 Arm=±0.672,1.306
    //               ForeArm=±1.247,1.203 Spine1=[0,0.875] Hips=[0,0.437]
    //               UpLeg=±0.311,0.324 Leg=±0.566,−0.947
    hitboxes: [
      // CHEST — between Spine1(0.875) and Spine2(1.145), pushed forward (Z- = front for rotated model)
      { group: 'chest',      position: [-0.22,  1.01, -0.23], rotation: [-0.554, 0,  0],     scale: [0.25, 0.16, 0.13] },
      { group: 'chest',      position: [ 0.22,  1.01, -0.23], rotation: [-0.554, 0,  0],     scale: [0.25, 0.16, 0.13] },
      // SHOULDERS — deltoid: at arm bone (X=0.672, Y=1.306), rotated diagonally
      { group: 'shoulders',  position: [-0.67,  1.31, -0.13], rotation: [0, 0, -0.724],      scale: [0.45, 0.13, 0.18] },
      { group: 'shoulders',  position: [ 0.67,  1.31, -0.13], rotation: [0, 0,  0.724],      scale: [0.45, 0.13, 0.18] },
      // BICEPS — mid upper arm: front of arm (Z-)
      { group: 'biceps',     position: [-0.96,  1.26, -0.19], rotation: [0, 0,  0],          scale: [0.48, 0.12, 0.13] },
      { group: 'biceps',     position: [ 0.96,  1.26, -0.19], rotation: [0, 0,  0],          scale: [0.48, 0.12, 0.13] },
      // TRICEPS — back of arm (Z+)
      { group: 'triceps',    position: [-0.96,  1.26,  0.15], rotation: [0, 0,  0],          scale: [0.42, 0.10, 0.12] },
      { group: 'triceps',    position: [ 0.96,  1.26,  0.15], rotation: [0, 0,  0],          scale: [0.42, 0.10, 0.12] },
      // FOREARMS — mid forearm
      { group: 'forearms',   position: [-1.50,  1.20, -0.13], rotation: [0, 0,  0],          scale: [0.42, 0.11, 0.12] },
      { group: 'forearms',   position: [ 1.50,  1.20, -0.13], rotation: [0, 0,  0],          scale: [0.42, 0.11, 0.12] },
      // ABS — front torso (Z-)
      { group: 'abs',        position: [-0.18,  0.76, -0.17], rotation: [0, 0,  0],          scale: [0.22, 0.35, 0.08] },
      { group: 'abs',        position: [ 0.18,  0.76, -0.17], rotation: [0, 0,  0],          scale: [0.22, 0.35, 0.08] },
      // GLUTES — rear (Z+)
      { group: 'glutes',     position: [-0.28,  0.36,  0.16], rotation: [0, 0,  0],          scale: [0.18, 0.18, 0.13] },
      { group: 'glutes',     position: [ 0.28,  0.36,  0.16], rotation: [0, 0,  0],          scale: [0.18, 0.18, 0.13] },
      // QUADS — front thigh (Z-)
      { group: 'quads',      position: [-0.44, -0.31, -0.08], rotation: [0, 0,  0],          scale: [0.16, 0.28, 0.13] },
      { group: 'quads',      position: [ 0.44, -0.31, -0.08], rotation: [0, 0,  0],          scale: [0.16, 0.28, 0.13] },
      // HAMSTRINGS — rear thigh (Z+)
      { group: 'hamstrings', position: [-0.44, -0.31,  0.12], rotation: [0, 0,  0],          scale: [0.14, 0.28, 0.12] },
      { group: 'hamstrings', position: [ 0.44, -0.31,  0.12], rotation: [0, 0,  0],          scale: [0.14, 0.28, 0.12] },
      // CALVES — rear lower leg (Z+)
      { group: 'calves',     position: [-0.53, -1.40,  0.08], rotation: [0, 0,  0],          scale: [0.12, 0.27, 0.12] },
      { group: 'calves',     position: [ 0.53, -1.40,  0.08], rotation: [0, 0,  0],          scale: [0.12, 0.27, 0.12] },
      // BACK — lats/traps (Z+)
      { group: 'back',       position: [-0.22,  0.80,  0.16], rotation: [0, 0,  0],          scale: [0.22, 0.40, 0.13] },
      { group: 'back',       position: [ 0.22,  0.80,  0.16], rotation: [0, 0,  0],          scale: [0.22, 0.40, 0.13] },
    ],
  },
  gokuSSJ: {
    path: '/models/super_saiyan_goku_rigged.glb',
    rotationY: Math.PI,
    scaleMult: 1.0,
    // Now RIGGED via Mixamo (33-bone skeleton + idle clip) → muscles are
    // bone-derived through the pipeline like Goku/Gohan. These hitboxes are the
    // legacy static fallback, only used if the rig ever fails to resolve.
    hitboxes: [
      { group: 'chest',      position: [-0.22,  1.01, -0.23], rotation: [-0.554, 0,  0],     scale: [0.25, 0.16, 0.13] },
      { group: 'chest',      position: [ 0.22,  1.01, -0.23], rotation: [-0.554, 0,  0],     scale: [0.25, 0.16, 0.13] },
      { group: 'shoulders',  position: [-0.67,  1.31, -0.13], rotation: [0, 0, -0.724],      scale: [0.45, 0.13, 0.18] },
      { group: 'shoulders',  position: [ 0.67,  1.31, -0.13], rotation: [0, 0,  0.724],      scale: [0.45, 0.13, 0.18] },
      { group: 'biceps',     position: [-0.96,  1.26, -0.19], rotation: [0, 0,  0],          scale: [0.48, 0.12, 0.13] },
      { group: 'biceps',     position: [ 0.96,  1.26, -0.19], rotation: [0, 0,  0],          scale: [0.48, 0.12, 0.13] },
      { group: 'triceps',    position: [-0.96,  1.26,  0.15], rotation: [0, 0,  0],          scale: [0.42, 0.10, 0.12] },
      { group: 'triceps',    position: [ 0.96,  1.26,  0.15], rotation: [0, 0,  0],          scale: [0.42, 0.10, 0.12] },
      { group: 'forearms',   position: [-1.50,  1.20, -0.13], rotation: [0, 0,  0],          scale: [0.42, 0.11, 0.12] },
      { group: 'forearms',   position: [ 1.50,  1.20, -0.13], rotation: [0, 0,  0],          scale: [0.42, 0.11, 0.12] },
      { group: 'abs',        position: [-0.18,  0.76, -0.17], rotation: [0, 0,  0],          scale: [0.22, 0.35, 0.08] },
      { group: 'abs',        position: [ 0.18,  0.76, -0.17], rotation: [0, 0,  0],          scale: [0.22, 0.35, 0.08] },
      { group: 'glutes',     position: [-0.28,  0.36,  0.16], rotation: [0, 0,  0],          scale: [0.18, 0.18, 0.13] },
      { group: 'glutes',     position: [ 0.28,  0.36,  0.16], rotation: [0, 0,  0],          scale: [0.18, 0.18, 0.13] },
      { group: 'quads',      position: [-0.44, -0.31, -0.08], rotation: [0, 0,  0],          scale: [0.16, 0.28, 0.13] },
      { group: 'quads',      position: [ 0.44, -0.31, -0.08], rotation: [0, 0,  0],          scale: [0.16, 0.28, 0.13] },
      { group: 'hamstrings', position: [-0.44, -0.31,  0.12], rotation: [0, 0,  0],          scale: [0.14, 0.28, 0.12] },
      { group: 'hamstrings', position: [ 0.44, -0.31,  0.12], rotation: [0, 0,  0],          scale: [0.14, 0.28, 0.12] },
      { group: 'calves',     position: [-0.53, -1.40,  0.08], rotation: [0, 0,  0],          scale: [0.12, 0.27, 0.12] },
      { group: 'calves',     position: [ 0.53, -1.40,  0.08], rotation: [0, 0,  0],          scale: [0.12, 0.27, 0.12] },
      { group: 'back',       position: [-0.22,  0.80,  0.16], rotation: [0, 0,  0],          scale: [0.22, 0.40, 0.13] },
      { group: 'back',       position: [ 0.22,  0.80,  0.16], rotation: [0, 0,  0],          scale: [0.22, 0.40, 0.13] },
    ],
  },
  gohan: {
    path: '/models/gohan.glb',
    rotationY: Math.PI,
    scaleMult: 1.0,
    // Bone-derived hitboxes (T-pose arms horizontal → sx is the long arm dimension).
    // Bone anchors: Spine2=[0,0.876,0.128] Shoulder=±0.181,1.160 Arm=±0.550,1.046
    //               ForeArm=±1.121,0.966 Spine1=[0,0.578] Hips=[0,0.094]
    //               UpLeg=±0.285,−0.030 Leg=±0.401,−1.090
    hitboxes: [
      // CHEST — between Spine1(0.578) and Spine2(0.876), mid=0.727, pushed forward
      { group: 'chest',      position: [-0.19,  0.73, -0.27], rotation: [-0.554, 0,  0],     scale: [0.22, 0.15, 0.12] },
      { group: 'chest',      position: [ 0.19,  0.73, -0.27], rotation: [-0.554, 0,  0],     scale: [0.22, 0.15, 0.12] },
      // SHOULDERS — deltoid: at arm bone (X=0.550, Y=1.046)
      { group: 'shoulders',  position: [-0.55,  1.05, -0.18], rotation: [0, 0, -0.724],      scale: [0.38, 0.12, 0.16] },
      { group: 'shoulders',  position: [ 0.55,  1.05, -0.18], rotation: [0, 0,  0.724],      scale: [0.38, 0.12, 0.16] },
      // BICEPS — front of arm (Z-)
      { group: 'biceps',     position: [-0.84,  1.01, -0.24], rotation: [0, 0,  0],          scale: [0.44, 0.11, 0.12] },
      { group: 'biceps',     position: [ 0.84,  1.01, -0.24], rotation: [0, 0,  0],          scale: [0.44, 0.11, 0.12] },
      // TRICEPS — back of arm (Z+)
      { group: 'triceps',    position: [-0.84,  1.01,  0.14], rotation: [0, 0,  0],          scale: [0.38, 0.10, 0.11] },
      { group: 'triceps',    position: [ 0.84,  1.01,  0.14], rotation: [0, 0,  0],          scale: [0.38, 0.10, 0.11] },
      // FOREARMS — mid forearm
      { group: 'forearms',   position: [-1.35,  0.97, -0.18], rotation: [0, 0,  0],          scale: [0.38, 0.10, 0.11] },
      { group: 'forearms',   position: [ 1.35,  0.97, -0.18], rotation: [0, 0,  0],          scale: [0.38, 0.10, 0.11] },
      // ABS — front torso (Z-)
      { group: 'abs',        position: [-0.16,  0.45, -0.20], rotation: [0, 0,  0],          scale: [0.20, 0.30, 0.07] },
      { group: 'abs',        position: [ 0.16,  0.45, -0.20], rotation: [0, 0,  0],          scale: [0.20, 0.30, 0.07] },
      // GLUTES — rear (Z+)
      { group: 'glutes',     position: [-0.24,  0.03,  0.14], rotation: [0, 0,  0],          scale: [0.16, 0.17, 0.12] },
      { group: 'glutes',     position: [ 0.24,  0.03,  0.14], rotation: [0, 0,  0],          scale: [0.16, 0.17, 0.12] },
      // QUADS — front thigh (Z-)
      { group: 'quads',      position: [-0.34, -0.56, -0.12], rotation: [0, 0,  0],          scale: [0.14, 0.26, 0.12] },
      { group: 'quads',      position: [ 0.34, -0.56, -0.12], rotation: [0, 0,  0],          scale: [0.14, 0.26, 0.12] },
      // HAMSTRINGS — rear thigh (Z+)
      { group: 'hamstrings', position: [-0.34, -0.56,  0.09], rotation: [0, 0,  0],          scale: [0.12, 0.26, 0.11] },
      { group: 'hamstrings', position: [ 0.34, -0.56,  0.09], rotation: [0, 0,  0],          scale: [0.12, 0.26, 0.11] },
      // CALVES — rear lower leg (Z+)
      { group: 'calves',     position: [-0.41, -1.55,  0.10], rotation: [0, 0,  0],          scale: [0.10, 0.25, 0.10] },
      { group: 'calves',     position: [ 0.41, -1.55,  0.10], rotation: [0, 0,  0],          scale: [0.10, 0.25, 0.10] },
      // BACK — lats/traps (Z+)
      { group: 'back',       position: [-0.18,  0.60,  0.15], rotation: [0, 0,  0],          scale: [0.18, 0.36, 0.11] },
      { group: 'back',       position: [ 0.18,  0.60,  0.15], rotation: [0, 0,  0],          scale: [0.18, 0.36, 0.11] },
    ],
  },
  anatomy: {
    path: '/models/muscle_body_rigged.glb',
    rotationY: 0,
    scaleMult: 1.0,
    // Calibrated from scratch against the actual anatomy GLB — do NOT
    // use buildStandardHitboxes, its Goku proportions don't map here.
    // Adding one muscle group at a time; debug wireframes are on.
    hitboxes: [
      // CHEST — calibrated against the anatomy GLB.
      { group: 'chest', position: [-0.226, 1.051, 0.166], rotation: [-0.554, 0, 0], scale: [0.217, 0.138, 0.108] },
      { group: 'chest', position: [ 0.226, 1.051, 0.166], rotation: [-0.554, 0, 0], scale: [0.217, 0.138, 0.108] },
      // SHOULDERS — calibrated against the anatomy GLB.
      { group: 'shoulders', position: [-0.501, 1.173, -0.171], rotation: [0.056,  0.097,  0.724], scale: [0.323, 0.091, -0.151] },
      { group: 'shoulders', position: [ 0.539, 1.173, -0.171], rotation: [0.056, -0.097, -0.724], scale: [0.323, 0.091, -0.151] },
      // BICEPS — calibrated against the anatomy GLB.
      { group: 'biceps', position: [-0.582, 0.809, -0.006], rotation: [0.323, -0.137, -0.348], scale: [0.145, 0.203, 0.079] },
      { group: 'biceps', position: [ 0.582, 0.809, -0.006], rotation: [0.323,  0.137,  0.348], scale: [0.145, 0.203, 0.079] },
      // TRICEPS — calibrated against the anatomy GLB.
      { group: 'triceps', position: [-0.614, 0.839, -0.334], rotation: [-0.185,  0.191, -0.399], scale: [0.099, 0.183, -0.080] },
      { group: 'triceps', position: [ 0.614, 0.839, -0.334], rotation: [-0.185, -0.191,  0.399], scale: [0.099, 0.183, -0.080] },
      // FOREARMS — calibrated against the anatomy GLB.
      { group: 'forearms', position: [-0.751, 0.143, -0.045], rotation: [-0.565, -0.093, -0.105], scale: [0.120, 0.258, 0.120] },
      { group: 'forearms', position: [ 0.751, 0.143, -0.045], rotation: [-0.565,  0.093,  0.105], scale: [0.120, 0.258, 0.120] },
      // ABS — calibrated against the anatomy GLB.
      { group: 'abs', position: [ 0, 0.501, 0.24], rotation: [0, 0, 0], scale: [0.198, 0.289, 0.062] },
      { group: 'abs', position: [ 0, 0.501, 0.24], rotation: [0, 0, 0], scale: [0.198, 0.289, 0.062] },
      // GLUTES — placeholder (visual estimate — drag to refine)
      { group: 'glutes', position: [-0.18, -0.20, -0.170], rotation: [0, 0, 0], scale: [0.150, 0.150, 0.110] },
      { group: 'glutes', position: [ 0.18, -0.20, -0.170], rotation: [0, 0, 0], scale: [0.150, 0.150, 0.110] },
      // QUADS — placeholder (visual estimate — drag to refine)
      { group: 'quads', position: [-0.16, -0.62, 0.120], rotation: [0, 0, 0], scale: [0.130, 0.240, 0.110] },
      { group: 'quads', position: [ 0.16, -0.62, 0.120], rotation: [0, 0, 0], scale: [0.130, 0.240, 0.110] },
      // HAMSTRINGS — placeholder (visual estimate — drag to refine)
      { group: 'hamstrings', position: [-0.16, -0.62, -0.145], rotation: [0, 0, 0], scale: [0.120, 0.240, 0.100] },
      { group: 'hamstrings', position: [ 0.16, -0.62, -0.145], rotation: [0, 0, 0], scale: [0.120, 0.240, 0.100] },
      // CALVES — placeholder (visual estimate — drag to refine)
      { group: 'calves', position: [-0.13, -1.20, -0.075], rotation: [0, 0, 0], scale: [0.095, 0.220, 0.095] },
      { group: 'calves', position: [ 0.13, -1.20, -0.075], rotation: [0, 0, 0], scale: [0.095, 0.220, 0.095] },
      // BACK — placeholder (lats/traps — drag to refine)
      { group: 'back', position: [-0.226, 0.900, -0.260], rotation: [0, 0, 0], scale: [0.220, 0.300, 0.110] },
      { group: 'back', position: [ 0.226, 0.900, -0.260], rotation: [0, 0, 0], scale: [0.220, 0.300, 0.110] },
    ],
  },
}

function buildStandardHitboxes({ bodyScale = 1.0 }) {
  const s = bodyScale
  return [
    // CHEST
    { group: 'chest', position: [-0.45 * s, 1.6 * s, 0.55 * s], scale: [0.55 * s, 0.4 * s, 0.32 * s] },
    { group: 'chest', position: [ 0.45 * s, 1.6 * s, 0.55 * s], scale: [0.55 * s, 0.4 * s, 0.32 * s] },

    // SHOULDERS
    { group: 'shoulders', position: [-1.15 * s, 1.85 * s, 0.05 * s], scale: [0.45 * s, 0.42 * s, 0.45 * s] },
    { group: 'shoulders', position: [ 1.15 * s, 1.85 * s, 0.05 * s], scale: [0.45 * s, 0.42 * s, 0.45 * s] },

    // BICEPS
    { group: 'biceps', position: [-1.25 * s, 1.4 * s, 0.35 * s], scale: [0.3 * s, 0.5 * s, 0.28 * s] },
    { group: 'biceps', position: [ 1.25 * s, 1.4 * s, 0.35 * s], scale: [0.3 * s, 0.5 * s, 0.28 * s] },

    // TRICEPS
    { group: 'triceps', position: [-1.25 * s, 1.4 * s, -0.3 * s], scale: [0.3 * s, 0.5 * s, 0.28 * s] },
    { group: 'triceps', position: [ 1.25 * s, 1.4 * s, -0.3 * s], scale: [0.3 * s, 0.5 * s, 0.28 * s] },

    // FOREARMS
    { group: 'forearms', position: [-1.55 * s, 0.45 * s, 0.15 * s], scale: [0.27 * s, 0.45 * s, 0.27 * s] },
    { group: 'forearms', position: [ 1.55 * s, 0.45 * s, 0.15 * s], scale: [0.27 * s, 0.45 * s, 0.27 * s] },

    // ABS
    { group: 'abs', shape: 'box', position: [-0.2 * s, 1.0 * s, 0.55 * s], scale: [0.18 * s, 0.16 * s, 0.16 * s] },
    { group: 'abs', shape: 'box', position: [ 0.2 * s, 1.0 * s, 0.55 * s], scale: [0.18 * s, 0.16 * s, 0.16 * s] },
    { group: 'abs', shape: 'box', position: [-0.2 * s, 0.65 * s, 0.55 * s], scale: [0.18 * s, 0.16 * s, 0.16 * s] },
    { group: 'abs', shape: 'box', position: [ 0.2 * s, 0.65 * s, 0.55 * s], scale: [0.18 * s, 0.16 * s, 0.16 * s] },
    { group: 'abs', shape: 'box', position: [-0.2 * s, 0.3 * s, 0.55 * s], scale: [0.18 * s, 0.16 * s, 0.16 * s] },
    { group: 'abs', shape: 'box', position: [ 0.2 * s, 0.3 * s, 0.55 * s], scale: [0.18 * s, 0.16 * s, 0.16 * s] },

    // GLUTES
    { group: 'glutes', position: [-0.32 * s, -0.4 * s, -0.45 * s], scale: [0.4 * s, 0.38 * s, 0.32 * s] },
    { group: 'glutes', position: [ 0.32 * s, -0.4 * s, -0.45 * s], scale: [0.4 * s, 0.38 * s, 0.32 * s] },

    // QUADS
    { group: 'quads', position: [-0.4 * s, -1.05 * s, 0.4 * s], scale: [0.36 * s, 0.6 * s, 0.3 * s] },
    { group: 'quads', position: [ 0.4 * s, -1.05 * s, 0.4 * s], scale: [0.36 * s, 0.6 * s, 0.3 * s] },

    // HAMSTRINGS
    { group: 'hamstrings', position: [-0.4 * s, -1.05 * s, -0.4 * s], scale: [0.34 * s, 0.6 * s, 0.28 * s] },
    { group: 'hamstrings', position: [ 0.4 * s, -1.05 * s, -0.4 * s], scale: [0.34 * s, 0.6 * s, 0.28 * s] },

    // CALVES
    { group: 'calves', position: [-0.42 * s, -2.55 * s, -0.3 * s], scale: [0.3 * s, 0.55 * s, 0.27 * s] },
    { group: 'calves', position: [ 0.42 * s, -2.55 * s, -0.3 * s], scale: [0.3 * s, 0.55 * s, 0.27 * s] },
  ]
}

// ── Camera positions derived from hitbox centers ────────────────────
// All muscle cameras use the same cinematic framing:
//   • 30° yaw off the straight-on axis (alternating left/right per muscle
//     so consecutive selections never feel repetitive)
//   • slight upward pitch so the camera looks down at the target
//   • pulled in closer than the overview for drama
// The overview camera (no selection) stays centered and unangled.
const OVERVIEW_CAM = { pos: [0, 0.6, -8], target: [0, 0.6, 0] }

// Alternating yaw sign per muscle group — keeps consecutive selections
// feeling distinct (one comes from the left, the next from the right).
const MUSCLE_YAW_SIGN = {
  chest: 1, shoulders: -1, biceps: 1, forearms: -1, abs: 1, quads: -1,
  triceps: 1, glutes: -1, hamstrings: 1, calves: -1, back: -1,
}

// How much of the frame the muscle should fill. >1 leaves breathing room
// around the muscle; bump up for more margin, down for a tighter close-up.
const VIEW_FILL  = 1.25
const VIEW_YAW   = Math.PI / 7   // ~26° off the straight-on axis
const VIEW_PITCH = 0.16          // ~9° downward tilt onto the target
const MIN_DIST   = 1.2           // never jam the camera into the body
// When a group's hitboxes are spread wider than this on X (arms held out in a
// T-pose — biceps/triceps/forearms/shoulders), fitting BOTH limbs zooms way out
// and reads as "no zoom". So for wide pairs we frame a SINGLE limb for a real
// close-up; the glow still lights both. Compact pairs (chest/abs/calves/etc.)
// stay framed together since their two sides nearly touch.
const WIDE_HALF_X = 0.85

// AABB over a list of hitboxes → { center:[x,y,z], half:[x,y,z] }. Each hitbox
// is a unit sphere/box scaled by `scale`, so its half-extent on an axis is
// |scale| (sphere radius 1 → extent = scale).
function _bbox(boxes) {
  let mnX = Infinity, mnY = Infinity, mnZ = Infinity
  let mxX = -Infinity, mxY = -Infinity, mxZ = -Infinity
  for (const h of boxes) {
    const [px, py, pz] = h.position
    const sx = Math.abs(h.scale[0]), sy = Math.abs(h.scale[1]), sz = Math.abs(h.scale[2])
    mnX = Math.min(mnX, px - sx); mxX = Math.max(mxX, px + sx)
    mnY = Math.min(mnY, py - sy); mxY = Math.max(mxY, py + sy)
    mnZ = Math.min(mnZ, pz - sz); mxZ = Math.max(mxZ, pz + sz)
  }
  return {
    center: [(mnX + mxX) / 2, (mnY + mxY) / 2, (mnZ + mxZ) / 2],
    half:   [(mxX - mnX) / 2, (mxY - mnY) / 2, (mxZ - mnZ) / 2],
  }
}

// Per-group camera target derived straight from hitbox geometry — no hardcoded
// numbers, so ANY model with calibrated hitboxes gets correct size-aware framing
// for free. Wide T-pose pairs collapse to the single limb the camera will face.
function computeMuscleCameras(hitboxes) {
  const groups = {}
  for (const h of hitboxes) {
    if (!groups[h.group]) groups[h.group] = []
    groups[h.group].push(h)
  }

  const cameras = {}
  for (const [group, boxes] of Object.entries(groups)) {
    const full = _bbox(boxes)
    // Front muscles sit on one Z hemisphere, back muscles the other — approach
    // from the muscle's own side so we never look through the body.
    const frontSign = full.center[2] >= 0 ? 1 : -1

    let box = full
    if (full.half[0] > WIDE_HALF_X) {
      // Pick the limb on the side the camera naturally swings to (frontSign ×
      // yaw), so it frames the limb head-on instead of across the torso.
      const pick = (frontSign * (MUSCLE_YAW_SIGN[group] ?? 1)) >= 0 ? 1 : -1
      const side = boxes.filter((h) => (h.position[0] * pick) >= 0)
      if (side.length) box = _bbox(side)
    }

    cameras[group] = { group, center: box.center, half: box.half, frontSign }
  }
  return cameras
}

// Fit the camera to a muscle group: distance is solved from the live FOV +
// aspect so the bounding box fills the frame to VIEW_FILL on whichever axis
// is the tighter constraint. Works for a thin tall calf or a wide forearm
// span alike, and adapts automatically when the canvas is resized.
function framePose(cfg, camera) {
  const center = new THREE.Vector3(...cfg.center)
  const vFov = (camera.fov * Math.PI) / 180
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (camera.aspect || 1))
  const [hx, hy, hz] = cfg.half

  const distW = (hx * VIEW_FILL) / Math.tan(hFov / 2)   // fit width
  const distH = (hy * VIEW_FILL) / Math.tan(vFov / 2)   // fit height
  // Back off past the muscle's own depth so the near face isn't clipped.
  const dist = Math.max(distW, distH, MIN_DIST) + hz

  const yaw = (MUSCLE_YAW_SIGN[cfg.group] ?? 1) * VIEW_YAW
  const fs  = cfg.frontSign
  const dir = new THREE.Vector3(
    fs * Math.sin(yaw) * Math.cos(VIEW_PITCH),
    Math.sin(VIEW_PITCH),
    fs * Math.cos(yaw) * Math.cos(VIEW_PITCH),
  )

  return { pos: center.clone().addScaledVector(dir, dist), target: center }
}

// Per-model glow position offsets — only needed if a model's hitboxes
// don't fully align with its geometry after calibration.
const GLOW_OFFSETS = {}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ── Persona 5 Camera Rig ───────────────────────────────────────────
// Replaces OrbitControls entirely. Handles all camera movement:
//   • Auto-rotate when at overview (no selection)
//   • Zoom in on new selection
//   • Zoom out → pan in when switching muscles
//   • Zoom out on dismiss
function CameraRig({ focusGroup, muscleCameras, onSettled, play, poseFor }) {
  const { camera } = useThree()

  // Resolve the camera pose for a group. `poseFor` (bone-driven, live) wins so
  // rigged models target the real skeleton; otherwise fall back to the static
  // hitbox-derived framing. Returns null → caller uses overview.
  const resolveTo = (group) => {
    if (poseFor) return poseFor(group, camera)
    const cfg = muscleCameras && muscleCameras[group]
    return cfg ? framePose(cfg, camera) : null
  }

  // Continuously interpolated camera state (so we always know where we are mid-animation)
  const camPos    = useRef(new THREE.Vector3(...OVERVIEW_CAM.pos))
  const camTarget = useRef(new THREE.Vector3(...OVERVIEW_CAM.target))

  const animFrom = useRef({
    pos:    new THREE.Vector3(...OVERVIEW_CAM.pos),
    target: new THREE.Vector3(...OVERVIEW_CAM.target),
  })
  const animTo = useRef({
    pos:    new THREE.Vector3(...OVERVIEW_CAM.pos),
    target: new THREE.Vector3(...OVERVIEW_CAM.target),
  })

  // 'idle' | 'out' | 'in'
  const phase         = useRef('idle')
  const progress      = useRef(1)
  const prevFocus     = useRef(null)
  const pendingGroup  = useRef(null)
  const autoRotAngle  = useRef(Math.atan2(OVERVIEW_CAM.pos[0], OVERVIEW_CAM.pos[2]))

  useEffect(() => {
    const prev = prevFocus.current
    prevFocus.current = focusGroup
    if (focusGroup === prev) return

    // Snapshot current interpolated camera as the animation start point
    animFrom.current.pos.copy(camPos.current)
    animFrom.current.target.copy(camTarget.current)
    progress.current = 0

    if (!focusGroup) {
      // Dismissed — zoom out to overview
      animTo.current.pos.set(...OVERVIEW_CAM.pos)
      animTo.current.target.set(...OVERVIEW_CAM.target)
      phase.current = 'out'
      pendingGroup.current = null
      play('camera-swoosh')
    } else if (prev) {
      // Switching muscles — zoom out first, pendingGroup triggers zoom-in after
      animTo.current.pos.set(...OVERVIEW_CAM.pos)
      animTo.current.target.set(...OVERVIEW_CAM.target)
      phase.current = 'out'
      pendingGroup.current = focusGroup
      play('camera-swoosh')
    } else {
      // First selection from overview — zoom in directly
      const to = resolveTo(focusGroup)
      if (to) {
        animTo.current.pos.copy(to.pos)
        animTo.current.target.copy(to.target)
      } else {
        animTo.current.pos.set(...OVERVIEW_CAM.pos)
        animTo.current.target.set(...OVERVIEW_CAM.target)
      }
      phase.current = 'in'
      pendingGroup.current = null
      play('camera-swoosh')
    }
  }, [focusGroup])

  useFrame((_, delta) => {
    const SPEED = 1.4 // full animation in ~0.7 s

    if (phase.current !== 'idle') {
      progress.current = Math.min(1, progress.current + delta * SPEED)
      const t = easeInOutCubic(progress.current)

      camPos.current.lerpVectors(animFrom.current.pos, animTo.current.pos, t)
      camTarget.current.lerpVectors(animFrom.current.target, animTo.current.target, t)

      camera.position.copy(camPos.current)
      camera.lookAt(camTarget.current)

      if (progress.current >= 1) {
        if (phase.current === 'out' && pendingGroup.current) {
          // Phase 1 (zoom-out) done — start phase 2 (zoom-in to pending group)
          animFrom.current.pos.copy(camPos.current)
          animFrom.current.target.copy(camTarget.current)
          const to = resolveTo(pendingGroup.current)
          if (to) {
            animTo.current.pos.copy(to.pos)
            animTo.current.target.copy(to.target)
          } else {
            animTo.current.pos.set(...OVERVIEW_CAM.pos)
            animTo.current.target.set(...OVERVIEW_CAM.target)
          }
          phase.current = 'in'
          progress.current = 0
          pendingGroup.current = null
          play('camera-swoosh')
        } else {
          phase.current = 'idle'
          // Sync autoRotAngle so the slow rotation resumes from the right angle
          autoRotAngle.current = Math.atan2(camPos.current.x, camPos.current.z)
          // Tell the scene the camera has landed — highlight can now fire.
          // Only signal a settled focus group; dismiss clears via useEffect.
          if (onSettled && focusGroup) onSettled(focusGroup)
        }
      }
    } else if (!focusGroup) {
      // Idle, no selection — slow auto-rotate around the model
      autoRotAngle.current += delta * 0.25
      const r = Math.sqrt(
        OVERVIEW_CAM.pos[0] ** 2 + OVERVIEW_CAM.pos[2] ** 2
      )
      const x = Math.sin(autoRotAngle.current) * r
      const z = Math.cos(autoRotAngle.current) * r
      camPos.current.set(x, OVERVIEW_CAM.pos[1], z)
      camera.position.copy(camPos.current)
      camera.lookAt(camTarget.current)
    } else if (poseFor) {
      // Settled on a muscle of a RIGGED model — keep tracking it live so the
      // shot follows the skeleton during animation. Gentle lerp avoids jitter.
      const to = resolveTo(focusGroup)
      if (to) {
        const k = Math.min(1, delta * 5)
        camPos.current.lerp(to.pos, k)
        camTarget.current.lerp(to.target, k)
        camera.position.copy(camPos.current)
        camera.lookAt(camTarget.current)
      }
    }
  })

  return null
}

// ── Hitbox — pure invisible click zone, no visual shape ────────────
// Opacity is always 0. The gold highlight comes from FocusLight below.
// Clicking a hitbox only focuses the camera on that muscle — selection
// for training is handled separately via the checkbox in the side panel.
function Hitbox({ group, position, scale, rotation, shape = 'sphere', onFocus }) {
  return (
    <mesh
      position={position}
      rotation={rotation || [0, 0, 0]}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation()
        onFocus(group)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
      }}
    >
      {shape === 'box'
        ? <boxGeometry args={[1, 1, 1]} />
        : <sphereGeometry args={[1, 16, 16]} />
      }
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

// ── Glow Flash — projects the hitbox shapes of the focused muscle onto
// the body using an inverted-depth additive trick.
//
// Instead of a single sphere at the muscle's center, we render each
// hitbox belonging to the focused group as its own volumetric glow. The
// hitboxes already encode muscle shape and placement (chest is 2 wide
// boxes, biceps are 2 oblong capsules, abs is a 6-pack of small cubes,
// etc.) so this gives an anatomically accurate highlight for free.
//
// How the projection works:
//   depthFunc = GreaterDepth → pass only where existing depth < our depth,
//                               i.e. where the body is in front of the volume
//   side      = BackSide     → render the inner wall of each volume, giving
//                               one additive contribution per covered pixel
//   additive + no depth write → color adds to the body, never occludes
//
// Result: the body's pixels get tinted gold *exactly* within the union of
// the hitbox volumes for that muscle, and nowhere else.
//
// Keyed off `settledGroup` so the flash only appears after the camera has
// landed. Pulses for 1.5 s then fades out over 0.5 s.
function GlowFlash({ settledGroup, hitboxes, modelKey }) {
  const groupRef = useRef()
  const focusTime = useRef(null)

  useEffect(() => {
    focusTime.current = settledGroup ? Date.now() : null
  }, [settledGroup])

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    if (!focusTime.current) {
      g.visible = false
      return
    }
    g.visible = true

    const elapsed = (Date.now() - focusTime.current) / 1000
    const RAMP = 0.4

    // Ramp up fast, then HOLD while the muscle stays focused — the glow
    // only clears when the user switches muscle or dismisses (settledGroup
    // goes null upstream). A gentle pulse keeps it alive without fading out.
    const envelope = elapsed < RAMP ? elapsed / RAMP : 1
    const opPulse  = 0.78 + Math.sin(Date.now() * 0.006) * 0.22
    // Scale each shell by ITS OWN base opacity (captured once) so the core and
    // the fainter halo keep their relative strengths through the pulse.
    g.traverse((obj) => {
      if (!obj.material) return
      if (obj.material.userData.base === undefined) obj.material.userData.base = obj.material.opacity
      obj.material.opacity = obj.material.userData.base * envelope * opPulse
    })
  })

  if (!settledGroup) return null
  const groupBoxes = hitboxes.filter((h) => h.group === settledGroup)
  if (groupBoxes.length === 0) return null

  // Robust additive-shell glow. The old stencil-projection trick painted gold
  // onto the body only where a hitbox volume punched through the surface — it
  // worked on the chest but silently vanished on thin/rear muscles (calves) and
  // depends on viewing angle. This instead renders each hitbox as an additive
  // gold shell, slightly inflated so it pokes through the muscle surface toward
  // the camera. depthTest stays ON so nearer body parts occlude it (it hugs the
  // muscle instead of floating), depthWrite OFF so shells never block each other.
  // No stencil, no depth-func games → it shows on EVERY muscle and EVERY model.
  const INFLATE = 1.15

  const offsets = GLOW_OFFSETS[modelKey] || {}
  const muscleOffset = offsets[settledGroup] || [0, 0, 0]

  return (
    <group ref={groupRef}>
      {groupBoxes.map((h, i) => {
        // abs() the scale — negative components only flip face winding, which
        // is irrelevant for a symmetric additive shell. Some hitboxes are razor
        // thin on one axis (a bicep is wide+flat) which would render as a
        // FLOATING DISC instead of wrapping the limb, so clamp every axis to a
        // minimum fraction of the largest — the glow becomes a rounded muscle
        // volume embedded in the limb, not a plate hovering off it.
        const ax = Math.abs(h.scale[0]), ay = Math.abs(h.scale[1]), az = Math.abs(h.scale[2])
        const minThick = Math.max(ax, ay, az) * 0.55
        const scale = [
          Math.max(ax, minThick) * INFLATE,
          Math.max(ay, minThick) * INFLATE,
          Math.max(az, minThick) * INFLATE,
        ]
        const position = [
          h.position[0] + muscleOffset[0],
          h.position[1] + muscleOffset[1],
          h.position[2] + muscleOffset[2],
        ]
        const rotation = h.rotation || [0, 0, 0]
        const geom = h.shape === 'box'
          ? <boxGeometry args={[1, 1, 1]} />
          : <sphereGeometry args={[1, 24, 24]} />
        return (
          <group key={`${settledGroup}-${i}`}>
            {/* Paint-on-body glow, single pass. BackSide + GreaterDepth means a
                back-face fragment only draws where the BODY is in front of it —
                i.e. where the muscle volume actually overlaps the mesh. Over the
                empty background (depth = far) the test fails, so NO floating disc
                and no spill, even if a hitbox sits slightly off the limb. Works
                on every muscle/model without stencil gymnastics. */}
            <mesh position={position} rotation={rotation} scale={scale} renderOrder={1000 + i}>
              {geom}
              <meshBasicMaterial
                color="#ffcc00"
                transparent
                opacity={0.9}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                depthTest
                depthFunc={THREE.GreaterDepth}
                side={THREE.BackSide}
                toneMapped={false}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// ── The displayed model ─────────────────────────────────────────────
function ModelDisplay({ modelKey, onReady }) {
  const config = MODELS[modelKey] || MODELS.goku
  const { scene, animations } = useGLTF(config.path)
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene])

  // Hand the live clone (with its skeleton) up to SceneContent so it can
  // drive bone-based muscles. Runs after mount so the primitive transform is
  // applied and bone world-matrices are valid.
  useEffect(() => {
    if (onReady) onReady(cloned)
    return () => { if (onReady) onReady(null) }
  }, [cloned, onReady])

  // Animation playback — plays the model's first clip BY DEFAULT for rigged
  // models (Goku Idle, Gohan Kamehameha, SSJ, etc.). The bone-driven muscles +
  // camera track the moving skeleton automatically. Opt out with ?anim=0.
  const mixerRef = useRef(null)
  const hipsRef = useRef(null)
  const hipsRest = useRef(null)
  useEffect(() => {
    // Find the Hips/root bone so we can plant horizontal root motion (below).
    let hips = null
    cloned.traverse((o) => { if (o.isBone && !hips && /hips$/i.test(_stripBone(o.name))) hips = o })
    hipsRef.current = hips
    hipsRest.current = hips ? { x: hips.position.x, z: hips.position.z } : null
  }, [cloned])
  useEffect(() => {
    const off = typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('anim') === '0'
    if (off || !animations || !animations.length) return
    const mixer = new THREE.AnimationMixer(cloned)
    const action = mixer.clipAction(animations[0])
    action.reset().play()
    mixerRef.current = mixer
    return () => { mixer.stopAllAction(); mixerRef.current = null }
  }, [cloned, animations])
  useFrame((_, dt) => {
    if (!mixerRef.current) return
    mixerRef.current.update(dt)
    // Strip horizontal ROOT MOTION — pin the Hips to its rest X/Z so clips that
    // stride (e.g. Mixamo "Blocking") idle in place instead of wandering off
    // the overview. Vertical bob (Y) is kept. Works for any model/clip.
    const h = hipsRef.current, r = hipsRest.current
    if (h && r) { h.position.x = r.x; h.position.z = r.z }
  })

  const modelLayout = useMemo(() => {
    // ── Selective bind-pose restore for arm/spine bones ───────────────
    // Goku and Gohan are stored in action poses. We restore ONLY the
    // upper-body bones (shoulders, arms, spine) to their bind-pose
    // quaternions using the boneInverse matrices — leaving hips/legs/root
    // untouched so the model stays at the same world position.
    // Full skeleton.pose() shifts the root bone and breaks Center's centering.
    const ARM_BONES = new Set([
      'mixamorigLeftShoulder',  'mixamorigRightShoulder',
      'mixamorigLeftArm',       'mixamorigRightArm',
      'mixamorigLeftForeArm',   'mixamorigRightForeArm',
      'mixamorigLeftHand',      'mixamorigRightHand',
      'mixamorigSpine',         'mixamorigSpine1', 'mixamorigSpine2',
      'mixamorigNeck',
    ])

    const _boneWorld = new THREE.Matrix4()
    const _parentWorld = new THREE.Matrix4()
    const _local = new THREE.Matrix4()
    const _pos = new THREE.Vector3()
    const _quat = new THREE.Quaternion()
    const _scale = new THREE.Vector3()

    cloned.traverse((obj) => {
      if (!obj.isSkinnedMesh || !obj.skeleton) return
      const { bones, boneInverses } = obj.skeleton
      for (let i = 0; i < bones.length; i++) {
        const bone = bones[i]
        if (!bone) continue
        const baseName = bone.name.replace(/_\d+$/, '')
        if (!ARM_BONES.has(baseName)) continue
        // Bind-pose world matrix = boneInverse⁻¹
        _boneWorld.copy(boneInverses[i]).invert()
        // Parent bind-pose world matrix
        if (bone.parent?.isBone) {
          const pi = bones.indexOf(bone.parent)
          _parentWorld.copy(pi >= 0 ? boneInverses[pi] : new THREE.Matrix4()).invert()
        } else {
          _parentWorld.identity()
        }
        // Local = parentWorld⁻¹ × myWorld
        _local.copy(_parentWorld).invert().multiply(_boneWorld)
        _local.decompose(_pos, _quat, _scale)
        bone.position.copy(_pos)
        bone.quaternion.copy(_quat)
        bone.scale.copy(_scale)
      }
    })
    cloned.updateMatrixWorld(true)

    const box = new THREE.Box3()
    let first = true
    cloned.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        const meshBox = new THREE.Box3().setFromObject(obj)
        if (first) { box.copy(meshBox); first = false }
        else { box.union(meshBox) }
      }
    })
    if (first) return [1, new THREE.Vector3()]
    const center = new THREE.Vector3()
    box.getCenter(center)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = maxDim === 0 ? 1 : (TARGET_HEIGHT / maxDim) * (config.scaleMult ?? 1)
    return [scale, center]
  }, [cloned, config.scaleMult])

  const normalizedScale  = modelLayout[0]
  const rawCenter        = modelLayout[1]

  // ── DOM emitter — writes mesh geometry into a hidden element so
  // Playwright (and the auto-calibrator) can read exact world-space
  // positions without guessing from pixels.
  useEffect(() => {
    const fmt = (v) => Math.round(v * 1000) / 1000
    const meshData = []

    cloned.updateMatrixWorld(true)
    cloned.traverse((obj) => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return
      const box = new THREE.Box3().setFromObject(obj)
      const center = new THREE.Vector3()
      const size   = new THREE.Vector3()
      box.getCenter(center)
      box.getSize(size)
      // Multiply by normalizedScale so values match hitbox coordinate space
      meshData.push({
        name:   obj.name || '(unnamed)',
        center: [fmt(center.x * normalizedScale), fmt(center.y * normalizedScale), fmt(center.z * normalizedScale)],
        size:   [fmt(size.x   * normalizedScale), fmt(size.y   * normalizedScale), fmt(size.z   * normalizedScale)],
      })
    })

    // Also include the current hitbox config so Playwright can diff them
    const hitboxes = (MODELS[modelKey] || MODELS.goku).hitboxes

    let el = document.getElementById('scene-mesh-data')
    if (!el) {
      el = document.createElement('div')
      el.id = 'scene-mesh-data'
      el.style.display = 'none'
      document.body.appendChild(el)
    }
    el.dataset.model    = modelKey
    el.dataset.meshes   = JSON.stringify(meshData)
    el.dataset.hitboxes = JSON.stringify(hitboxes)

    // ── Bone world-position emitter ───────────────────────────────────
    // Bone positions are in raw (un-normalized) model space after T-pose
    // zeroing.  We convert them to the same "Center-adjusted normalized"
    // coordinate space that hitboxes use:
    //   normalized = (raw_pos - bbox_center) * normalizedScale
    // bbox_center here is the RAW geometry center (Center component
    // cancels it at render time, so our hitboxes must do the same).
    const rawBox = new THREE.Box3()
    let rawFirst = true
    cloned.traverse((obj) => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return
      const mb = new THREE.Box3().setFromObject(obj)
      if (rawFirst) { rawBox.copy(mb); rawFirst = false }
      else { rawBox.union(mb) }
    })
    const rawCenter = new THREE.Vector3()
    rawBox.getCenter(rawCenter)

    const bonePositions = {}
    const wp = new THREE.Vector3()
    cloned.traverse((obj) => {
      if (!obj.isBone) return
      obj.getWorldPosition(wp)
      bonePositions[obj.name] = [
        fmt((wp.x - rawCenter.x) * normalizedScale),
        fmt((wp.y - rawCenter.y) * normalizedScale),
        fmt((wp.z - rawCenter.z) * normalizedScale),
      ]
    })

    el.dataset.bonePositions = JSON.stringify(bonePositions)

    // ── Animation emitter ─────────────────────────────────────────────
    const bones = Object.keys(bonePositions)

    let skinnedMeshCount = 0
    cloned.traverse((obj) => { if (obj.isSkinnedMesh) skinnedMeshCount++ })

    const animInfo = {
      animations: (animations || []).map((a) => ({
        name:     a.name,
        duration: a.duration,
        tracks:   a.tracks.length,
      })),
      bones,
      skinnedMeshes: skinnedMeshCount,
    }

    let animEl = document.getElementById('scene-anim-data')
    if (!animEl) {
      animEl = document.createElement('div')
      animEl.id = 'scene-anim-data'
      animEl.style.display = 'none'
      document.body.appendChild(animEl)
    }
    animEl.dataset.info = JSON.stringify(animInfo)
  }, [cloned, normalizedScale, modelKey, animations])

  // Manual centering: offset the model so its bounding-box center lands at world origin.
  // Must account for rotationY because Three.js applies rotation before translation.
  // For a point at raw position P: world = position + R_Y(θ) * (scale * P)
  // To place center at origin: position = -scale * R_Y(θ) * rawCenter
  //   cx = -scale * (Cx*cosθ - Cz*sinθ)
  //   cy = -scale * Cy
  //   cz = -scale * (Cx*sinθ + Cz*cosθ)
  // For models with center ≈ (0,0,0) this is the same as -scale*rawCenter,
  // but for off-origin models (e.g. GokuSSJ center at ~(1048,0,882)) the sign matters.
  const θ   = config.rotationY ?? 0
  const cosθ = Math.cos(θ)
  const sinθ = Math.sin(θ)
  const cx = -normalizedScale * (rawCenter.x * cosθ - rawCenter.z * sinθ)
  const cy = -rawCenter.y * normalizedScale
  const cz = -normalizedScale * (rawCenter.x * sinθ + rawCenter.z * cosθ)

  return (
    <primitive
      object={cloned}
      scale={normalizedScale}
      position={[cx, cy, cz]}
      rotation={[0, θ, 0]}
    />
  )
}

// ── Debug Hitbox Overlay ────────────────────────────────────────────
// Renders every hitbox for the current model as a colored wireframe so
// calibration mismatches are visible at a glance. Each muscle group gets
// its own color. Purely visual — click handling is still done by the
// regular invisible Hitbox meshes.
const DEBUG_GROUP_COLORS = {
  chest:      '#ff3344',
  shoulders:  '#ff8800',
  biceps:     '#ffcc00',
  triceps:    '#88ff00',
  forearms:   '#00ff88',
  abs:        '#00ffff',
  glutes:     '#0088ff',
  quads:      '#4400ff',
  hamstrings: '#aa00ff',
  calves:     '#ff00aa',
  back:       '#ccff44',
}

// Each debug hitbox is rendered as a draggable wireframe with its own
// TransformControls gizmo attached directly to the mesh (not wrapping
// it, which would move an outer group and give misleading values).
// Keyboard:
//   T → translate mode
//   S → scale mode
// Every drag logs the mesh's real, final position+scale to the console
// so you can copy the values straight back into the hitbox array.
function DebugHitbox({ hitbox, index, mode, logTransform, registerReporter }) {
  // Ref callback sets state on mount so the TransformControls can be
  // rendered on the next pass with `object={mesh}` pointing at the mesh.
  const [mesh, setMesh] = useState(null)
  const meshRef = useRef(null)

  useEffect(() => {
    if (!registerReporter) return
    const reporter = {
      group: hitbox.group,
      getTransforms: () => {
        const m = meshRef.current
        if (!m) return []
        const fmt = (v) => Number(v.toFixed(3))
        return [{
          position: [fmt(m.position.x), fmt(m.position.y), fmt(m.position.z)],
          rotation: [fmt(m.rotation.x), fmt(m.rotation.y), fmt(m.rotation.z)],
          scale:    [fmt(m.scale.x),    fmt(m.scale.y),    fmt(m.scale.z)],
        }]
      },
    }
    return registerReporter(reporter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <mesh
        ref={(el) => { meshRef.current = el; setMesh(el) }}
        position={hitbox.position}
        rotation={hitbox.rotation || [0, 0, 0]}
        scale={hitbox.scale}
      >
        {hitbox.shape === 'box'
          ? <boxGeometry args={[1, 1, 1]} />
          : <sphereGeometry args={[1, 16, 16]} />
        }
        <meshBasicMaterial
          color={DEBUG_GROUP_COLORS[hitbox.group] || '#ffffff'}
          wireframe
          transparent
          opacity={0.7}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      {mesh && (
        <TransformControls
          object={mesh}
          mode={mode}
          size={0.5}
          onObjectChange={() => logTransform(index, hitbox.group, mesh)}
        />
      )}
    </>
  )
}

// Tandem pair: two mirror-symmetric hitboxes (left + right) controlled
// by a single TransformControls gizmo attached to an invisible anchor
// at the pair's center.
//
// Position + scale move both spheres together (the right one is just
// the mirror of the left across X=0 plus the anchor's own X position).
// Rotation is applied to each sphere INDEPENDENTLY with a YZ-mirror on
// the right sphere so the two tilt symmetrically outward — e.g. rotating
// around the Z axis makes the left pec lean outward to the left and the
// right pec lean outward to the right, instead of both tilting the same
// absolute direction. The X rotation axis is shared (it's the mirror's
// fixed axis), while Y and Z are negated on the right sphere.
function DebugTandemPair({ hitboxes, group, indices, mode, registerReporter }) {
  const anchorRef = useRef(null)
  const [anchor, setAnchor] = useState(null)
  const leftRef  = useRef()
  const rightRef = useRef()

  // Initial center of the pair (Y/Z taken from either, X from midpoint)
  const cx = (hitboxes[0].position[0] + hitboxes[1].position[0]) / 2
  const cy = (hitboxes[0].position[1] + hitboxes[1].position[1]) / 2
  const cz = (hitboxes[0].position[2] + hitboxes[1].position[2]) / 2

  // Half-spread on X — each sphere sits at ±dx * anchor.scale.x from the
  // anchor's center after a translate + scale.
  const dx = Math.abs(hitboxes[0].position[0] - cx)

  const localScale    = hitboxes[0].scale
  const initialRot    = hitboxes[0].rotation || [0, 0, 0]

  // Set the anchor's initial transform once on mount. Doing this via an
  // effect (rather than declarative `position`/`rotation` props) prevents
  // React from re-applying those props on every re-render — which would
  // otherwise snap the anchor back to its starting transform every time
  // the user presses T/S/R to switch modes, clobbering the drag.
  useLayoutEffect(() => {
    if (!anchorRef.current) return
    anchorRef.current.position.set(cx, cy, cz)
    anchorRef.current.rotation.set(initialRot[0], initialRot[1], initialRot[2])
    setAnchor(anchorRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Store resolvePair in a ref so the reporter always reads the latest closure.
  const resolvePairRef = useRef(null)

  // Register this pair so F12 can snapshot it.
  useEffect(() => {
    if (!registerReporter) return
    const reporter = {
      group,
      getTransforms: () => {
        const fn = resolvePairRef.current
        if (!fn) return []
        const result = fn()
        if (!result) return []
        const fmt = (v) => Number(v.toFixed(3))
        const fmtArr = (arr) => arr.map(fmt)
        return [
          { position: fmtArr(result.left.position),  rotation: fmtArr(result.left.rotation),  scale: fmtArr(result.left.scale)  },
          { position: fmtArr(result.right.position), rotation: fmtArr(result.right.rotation), scale: fmtArr(result.right.scale) },
        ]
      },
    }
    return registerReporter(reporter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Compute each sphere's world transform from the anchor, with mirror
  // semantics: translate-X adjusts the spread symmetrically, translate
  // Y/Z moves both together, scale and (Y/Z) rotation are mirrored.
  // Shared helper so the live render and the copy-paste logger stay in
  // sync on the formula. Assigned to resolvePairRef each render so the
  // F12 reporter always captures the latest closure (anchor state etc).
  const resolvePair = () => {
    const gp = anchor.position
    const gs = anchor.scale
    const ge = anchor.rotation

    // xOffsetFromCenter = how far the gizmo has been dragged away from
    // the pair's original X midpoint. Positive = dragged right → bring
    // spheres inward. Negative = dragged left → push outward.
    const xOffsetFromCenter = gp.x - cx
    const currentDx = Math.max(0, dx * gs.x - xOffsetFromCenter)

    const sx = localScale[0] * gs.x
    const sy = localScale[1] * gs.y
    const sz = localScale[2] * gs.z

    return {
      left: {
        position: [cx - currentDx, gp.y, gp.z],
        rotation: [ge.x, ge.y, ge.z],
        scale:    [sx, sy, sz],
      },
      right: {
        position: [cx + currentDx, gp.y, gp.z],
        rotation: [ge.x, -ge.y, -ge.z],
        scale:    [sx, sy, sz],
      },
    }
  }

  // Keep the ref current on every render so the F12 reporter sees the
  // latest version (closes over the current `anchor` state value).
  resolvePairRef.current = anchor ? resolvePair : null

  useFrame(() => {
    if (!anchor || !leftRef.current || !rightRef.current) return
    const { left, right } = resolvePair()
    leftRef.current.position.set(...left.position)
    leftRef.current.rotation.set(...left.rotation)
    leftRef.current.scale.set(...left.scale)
    rightRef.current.position.set(...right.position)
    rightRef.current.rotation.set(...right.rotation)
    rightRef.current.scale.set(...right.scale)
  })

  const onChange = () => {
    if (!anchor) return
    const { left, right } = resolvePair()
    const fmt = (v) => Number(v.toFixed(3))
    const fmtArr = (arr) => `[${fmt(arr[0])}, ${fmt(arr[1])}, ${fmt(arr[2])}]`

    // eslint-disable-next-line no-console
    console.log(
      `[${group} #${indices[0]}] position: ${fmtArr(left.position)} rotation: ${fmtArr(left.rotation)} scale: ${fmtArr(left.scale)}`
    )
    // eslint-disable-next-line no-console
    console.log(
      `[${group} #${indices[1]}] position: ${fmtArr(right.position)} rotation: ${fmtArr(right.rotation)} scale: ${fmtArr(right.scale)}`
    )
  }

  const Geom = ({ shape }) => shape === 'box'
    ? <boxGeometry args={[1, 1, 1]} />
    : <sphereGeometry args={[1, 16, 16]} />

  const WireMat = () => (
    <meshBasicMaterial
      color={DEBUG_GROUP_COLORS[group] || '#ffffff'}
      wireframe
      transparent
      opacity={0.7}
      depthTest={false}
      toneMapped={false}
    />
  )

  return (
    <>
      {/* Invisible anchor — the TransformControls target. Its transform
          is the "virtual parent" state; the two visible spheres derive
          their transforms from it every frame (with mirroring on Y/Z
          rotation for the right sphere). Position/rotation are set
          imperatively in useLayoutEffect above, NOT as React props. */}
      <mesh ref={anchorRef} visible={false}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
      </mesh>

      <mesh ref={leftRef}>
        <Geom shape={hitboxes[0].shape} />
        <WireMat />
      </mesh>
      <mesh ref={rightRef}>
        <Geom shape={hitboxes[1].shape} />
        <WireMat />
      </mesh>

      {anchor && (
        <TransformControls
          object={anchor}
          mode={mode}
          size={0.5}
          onObjectChange={onChange}
        />
      )}
    </>
  )
}

function DebugHitboxes({ hitboxes, modelKey }) {
  const [mode, setMode] = useState('translate')
  const reportersRef = useRef([])

  // Returns an unregister function — called by the child on unmount.
  const registerReporter = (reporter) => {
    reportersRef.current.push(reporter)
    return () => {
      const idx = reportersRef.current.indexOf(reporter)
      if (idx >= 0) reportersRef.current.splice(idx, 1)
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase()
      if (k === 't') setMode('translate')
      else if (k === 's') setMode('scale')
      else if (k === 'r') setMode('rotate')
      else if (e.key === 'F12') {
        e.preventDefault()

        // Collect all current transforms from every registered gizmo.
        const byGroup = {}
        for (const reporter of reportersRef.current) {
          const transforms = reporter.getTransforms()
          if (!transforms.length) continue
          if (!byGroup[reporter.group]) byGroup[reporter.group] = []
          byGroup[reporter.group].push(...transforms)
        }

        // ── Code-paste format ─────────────────────────────────────────
        const fmtVal = (v) => Number(v.toFixed(3))
        const fmtArr = (arr) => `[${arr.map(fmtVal).join(', ')}]`

        // eslint-disable-next-line no-console
        console.group(`%c[F12 Calibration Snapshot] model: ${modelKey}`, 'color:#ffcc00;font-weight:bold')
        for (const [group, transforms] of Object.entries(byGroup)) {
          transforms.forEach((t, idx) => {
            // eslint-disable-next-line no-console
            console.log(
              `  { group: '${group}', position: ${fmtArr(t.position)}, rotation: ${fmtArr(t.rotation)}, scale: ${fmtArr(t.scale)} },`
            )
          })
        }
        // eslint-disable-next-line no-console
        console.groupEnd()

        // ── Training data JSON ────────────────────────────────────────
        const trainingRecord = {
          model: modelKey,
          timestamp: new Date().toISOString(),
          hitboxes: byGroup,
        }
        // eslint-disable-next-line no-console
        console.log('%c[Training Record JSON]', 'color:#00ffcc;font-weight:bold', JSON.stringify(trainingRecord, null, 2))

        // Also write to a downloadable file so we can accumulate training data.
        const blob = new Blob([JSON.stringify(trainingRecord, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `calibration_${modelKey}_${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modelKey])

  const logTransform = (i, group, obj) => {
    const p = obj.position
    const r = obj.rotation
    const s = obj.scale
    const fmt = (v) => Number(v.toFixed(3))
    // eslint-disable-next-line no-console
    console.log(
      `[${group} #${i}]`,
      `position: [${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}]`,
      `rotation: [${fmt(r.x)}, ${fmt(r.y)}, ${fmt(r.z)}]`,
      `scale: [${fmt(s.x)}, ${fmt(s.y)}, ${fmt(s.z)}]`
    )
  }

  // Group hitboxes by muscle group name; pairs of two render as a single
  // tandem gizmo, everything else as individual gizmos.
  const grouped = {}
  hitboxes.forEach((h, i) => {
    if (!grouped[h.group]) grouped[h.group] = []
    grouped[h.group].push({ hitbox: h, index: i })
  })

  return (
    <group>
      {Object.entries(grouped).map(([groupName, entries]) => {
        if (entries.length === 2) {
          return (
            <DebugTandemPair
              key={`tandem-${groupName}`}
              group={groupName}
              hitboxes={entries.map((e) => e.hitbox)}
              indices={entries.map((e) => e.index)}
              mode={mode}
              registerReporter={registerReporter}
            />
          )
        }
        return entries.map(({ hitbox, index }) => (
          <DebugHitbox
            key={`dbg-${index}`}
            hitbox={hitbox}
            index={index}
            mode={mode}
            logTransform={logTransform}
            registerReporter={registerReporter}
          />
        ))
      })}
    </group>
  )
}

// ── Background sphere — click anywhere to dismiss focus ─────────────
// A large hollow sphere (BackSide) that wraps the whole scene so any
// click that misses the model or hitboxes dismisses the current focus,
// regardless of which direction the camera is facing.
function BackgroundPlane({ onDismiss }) {
  return (
    <mesh
      onClick={(e) => {
        e.stopPropagation()
        onDismiss()
      }}
    >
      <sphereGeometry args={[25, 8, 8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.BackSide} />
    </mesh>
  )
}

// ── BONE-DRIVEN MUSCLES (any rigged humanoid) ────────────────────────
// For models with a standard mixamo skeleton, derive every muscle's position +
// size from the SKELETON instead of hand-placed hitboxes. ONE map below works
// for every such model → zero per-model calibration. Volumes are recomputed
// from live bone world-matrices each frame, so the glow AND the camera target
// follow ANIMATION automatically — which static hitboxes can never do.
//
// Limb muscles: a capsule between two bones, pushed to the front(+1)/back(-1)
// face of the limb. t = where along the bone span it centers; rFrac = radius as
// a fraction of the span length.
const LIMB_MUSCLES = {
  shoulders:  { from: 'Shoulder', to: 'Arm',     t: 0.55, rFrac: 0.7,  zBias: 0  },
  biceps:     { from: 'Arm',      to: 'ForeArm', t: 0.5,  rFrac: 0.36, zBias: 1  },
  triceps:    { from: 'Arm',      to: 'ForeArm', t: 0.5,  rFrac: 0.36, zBias: -1 },
  forearms:   { from: 'ForeArm',  to: 'Hand',    t: 0.42, rFrac: 0.34, zBias: 1  },
  quads:      { from: 'UpLeg',    to: 'Leg',     t: 0.5,  rFrac: 0.36, zBias: 1  },
  hamstrings: { from: 'UpLeg',    to: 'Leg',     t: 0.5,  rFrac: 0.36, zBias: -1 },
  calves:     { from: 'Leg',      to: 'Foot',    t: 0.4,  rFrac: 0.38, zBias: -1 },
  // glutes span the (sided) UpLeg up to the CENTRAL Hips bone — centerTo means
  // the "to" bone has no Left/Right prefix. Without this both entries look for a
  // non-existent LeftHips/RightHips bone and silently vanish.
  glutes:     { from: 'UpLeg',    to: 'Hips',    t: 0.18, rFrac: 0.5,  zBias: -1, centerTo: true },
}
// Central torso muscles ride the spine; width comes from shoulder span.
const TORSO_MUSCLES = {
  chest: { from: 'Spine1', to: 'Spine2', t: 0.75, zBias: 1  },
  abs:   { from: 'Spine',  to: 'Spine1', t: 0.5,  zBias: 1  },
  back:  { from: 'Spine1', to: 'Spine2', t: 0.55, zBias: -1 },
}

// Normalize any mixamo bone name to its bare base: strips the `mixamorig`
// prefix plus whatever separator follows (`:` from raw Mixamo, `_` from some
// GLB exporters, a space, or nothing) and any trailing dedupe index.
// e.g. "mixamorig:LeftArm" / "mixamorigLeftArm_09" / "mixamorig_LeftArm.001" → "LeftArm"
const _stripBone = (n) => n.replace(/^mixamorig[^A-Za-z]*/i, '').replace(/[_.]\d+$/, '')

function collectBones(root) {
  const map = {}
  root.traverse((o) => { if (o.isBone) { const b = _stripBone(o.name); if (!map[b]) map[b] = o } })
  return map
}

// Returns { entries, leftArm, rightArm, hips } for a rigged model, or null.
function buildBoneRig(root) {
  const B = collectBones(root)
  if (!B.Hips && !B.Spine) return null
  const entries = []
  for (const [group, s] of Object.entries(LIMB_MUSCLES)) {
    for (const side of ['Left', 'Right']) {
      const a = B[side + s.from]
      const b = B[(s.centerTo ? '' : side) + s.to]
      if (a && b) entries.push({ group, side, a, b, kind: 'limb', ...s })
    }
  }
  for (const [group, s] of Object.entries(TORSO_MUSCLES)) {
    const a = B[s.from], b = B[s.to]
    if (a && b) entries.push({ group, side: 'C', a, b, kind: 'torso', ...s })
  }
  if (!entries.length) return null
  return { entries, leftArm: B.LeftArm, rightArm: B.RightArm, hips: B.Hips || B.Spine }
}

// Scratch vectors — reused each frame to avoid per-frame allocation churn.
const _bA = new THREE.Vector3(), _bB = new THREE.Vector3()
const _bFwd = new THREE.Vector3(), _bLA = new THREE.Vector3(), _bRA = new THREE.Vector3()
const _bUp = new THREE.Vector3(0, 1, 0), _bQ = new THREE.Quaternion(), _bAxis = new THREE.Vector3()

// Anterior (body-forward) direction in WORLD space, taken live from the Hips
// bone so it stays correct as the character turns during animation.
function bodyForward(rig, out) {
  rig.hips.getWorldQuaternion(_bQ)
  return out.set(0, 0, 1).applyQuaternion(_bQ).setY(0).normalize()
}

// Compute a muscle's world frame from its bones. Writes into `f` and returns it.
function muscleFrame(e, rig, fwd, f) {
  e.a.getWorldPosition(_bA); e.b.getWorldPosition(_bB)
  f.center.lerpVectors(_bA, _bB, e.t)
  _bAxis.subVectors(_bB, _bA)
  const len = _bAxis.length() || 0.001
  let radius
  if (e.kind === 'limb') {
    radius = len * e.rFrac
  } else {
    let w = 0.35
    if (rig.leftArm && rig.rightArm) {
      rig.leftArm.getWorldPosition(_bLA); rig.rightArm.getWorldPosition(_bRA)
      w = _bLA.distanceTo(_bRA)
    }
    radius = w * 0.27
  }
  if (e.zBias) f.center.addScaledVector(fwd, e.zBias * radius * 0.7)
  _bAxis.normalize()
  f.quat.setFromUnitVectors(_bUp, _bAxis)
  const halfLen = Math.max(len * 0.5, radius)
  if (e.kind === 'limb') f.scale.set(radius, halfLen, radius)
  else f.scale.set(radius * 1.25, halfLen, radius * 0.8)
  f.radius = Math.max(radius, halfLen)
  return f
}

const _newFrame = () => ({ center: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3(), radius: 0 })

// Live camera pose for a rigged muscle group, computed from current bones.
// Wide limb pairs collapse to a single side (real close-up); torso/compact
// groups use the union. Mirrors the static framePose math but bone-sourced.
function makeBonePoseFor(rig) {
  const f = _newFrame()
  const fwd = new THREE.Vector3()
  const c = new THREE.Vector3()
  const dir = new THREE.Vector3()
  return (group, camera) => {
    const all = rig.entries.filter((e) => e.group === group)
    if (!all.length) return null
    bodyForward(rig, fwd)
    let chosen = all
    if (all.length > 1 && all[0].kind === 'limb') {
      const wantLeft = (MUSCLE_YAW_SIGN[group] ?? 1) < 0
      chosen = all.filter((e) => (e.side === 'Left') === wantLeft)
      if (!chosen.length) chosen = [all[0]]
    }
    c.set(0, 0, 0)
    let R = 0.001, zb = 0
    for (const e of chosen) {
      muscleFrame(e, rig, fwd, f)
      c.add(f.center); R = Math.max(R, f.radius); zb = e.zBias
    }
    c.multiplyScalar(1 / chosen.length)

    const vFov = (camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (camera.aspect || 1))
    let dist = (R * VIEW_FILL) / Math.sin(Math.min(vFov, hFov) / 2)
    dist = Math.max(dist, R + MIN_DIST)

    // Approach from the muscle's own face (front/back), offset by the cinematic
    // yaw + a touch of downward pitch.
    const approach = zb !== 0 ? Math.sign(zb) : 1
    dir.copy(fwd).multiplyScalar(approach)
    dir.applyAxisAngle(_bUp, (MUSCLE_YAW_SIGN[group] ?? 1) * VIEW_YAW)
    dir.y += Math.sin(VIEW_PITCH)
    dir.normalize()

    return { pos: c.clone().addScaledVector(dir, dist), target: c.clone() }
  }
}

// Renders the invisible click hitboxes (always) + the gold paint-on-body glow
// (focused group only), positioning every volume from live bone matrices each
// frame so they ride the skeleton through animation.
function BoneMuscleLayer({ rig, settledGroup, onFocus }) {
  const hitRefs = useRef([])
  const glowRefs = useRef([])
  const frame = useRef(_newFrame())
  const fwd = useRef(new THREE.Vector3())
  const focusTime = useRef(null)
  useEffect(() => { focusTime.current = settledGroup ? Date.now() : null }, [settledGroup])

  useFrame(() => {
    bodyForward(rig, fwd.current)
    let op = 0
    if (focusTime.current) {
      const elapsed = (Date.now() - focusTime.current) / 1000
      const env = elapsed < 0.4 ? elapsed / 0.4 : 1
      op = 0.9 * env * (0.78 + Math.sin(Date.now() * 0.006) * 0.22)
    }
    rig.entries.forEach((e, i) => {
      const f = muscleFrame(e, rig, fwd.current, frame.current)
      const h = hitRefs.current[i]
      if (h) { h.position.copy(f.center); h.quaternion.copy(f.quat); h.scale.copy(f.scale) }
      const g = glowRefs.current[i]
      if (g) {
        const on = e.group === settledGroup
        g.visible = on
        if (on) { g.position.copy(f.center); g.quaternion.copy(f.quat); g.scale.copy(f.scale); g.material.opacity = op }
      }
    })
  })

  return (
    <group>
      {rig.entries.map((e, i) => (
        <mesh
          key={`hit-${i}`}
          ref={(el) => { hitRefs.current[i] = el }}
          onClick={(ev) => { ev.stopPropagation(); onFocus(e.group) }}
          onPointerOver={(ev) => { ev.stopPropagation(); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { document.body.style.cursor = 'default' }}
        >
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {rig.entries.map((e, i) => (
        <mesh key={`glow-${i}`} ref={(el) => { glowRefs.current[i] = el }} renderOrder={1000 + i} visible={false}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color="#ffcc00"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest
            depthFunc={THREE.GreaterDepth}
            side={THREE.BackSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function SceneContent({ modelKey, focusedGroup, onFocus, debugMode, play }) {
  const config = MODELS[modelKey] || MODELS.goku

  // Derive camera positions from this model's hitboxes so the zoom-in
  // targets the actual geometry regardless of which model is loaded.
  const muscleCameras = useMemo(
    () => computeMuscleCameras(config.hitboxes),
    [config.hitboxes]
  )

  // Lifted from ModelDisplay once the GLB clone exists. If the model is rigged
  // (mixamo skeleton) we drive muscles from BONES — zero hand calibration and
  // animation-ready. Non-rigged models (static meshes) keep the hitbox path.
  const [clonedScene, setClonedScene] = useState(null)
  const rig = useMemo(() => (clonedScene ? buildBoneRig(clonedScene) : null), [clonedScene])
  const bonePoseFor = useMemo(() => (rig ? makeBonePoseFor(rig) : null), [rig])

  // `settledGroup` lags `focusedGroup` by the camera animation duration —
  // it only becomes non-null once CameraRig finishes easing into the muscle.
  // This is what the gold highlight light keys off of, so the flash appears
  // only after the camera has landed.
  const [settledGroup, setSettledGroup] = useState(null)

  // Any time the desired focus changes, clear the highlight immediately so
  // it can't leak across the animation. CameraRig will re-set it on landing.
  useEffect(() => {
    setSettledGroup(null)
  }, [focusedGroup])

  return (
    <group>
      {/* Base lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 6]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-5, 3, -4]} intensity={0.7} color="#ff6644" />
      <pointLight position={[0, 5, 5]} intensity={0.8} color="#ffaa66" />
      <pointLight position={[0, -2, 4]} intensity={0.4} color="#4488ff" />

      {/* Static-hitbox glow — only for NON-rigged models (rigged use bones) */}
      {!rig && (
        <GlowFlash
          settledGroup={settledGroup}
          hitboxes={config.hitboxes}
          modelKey={modelKey}
        />
      )}

      {/* Background click-to-dismiss plane */}
      <BackgroundPlane onDismiss={() => onFocus(null)} />

      <Suspense fallback={null}>
        <ModelDisplay key={modelKey} modelKey={modelKey} onReady={setClonedScene} />
      </Suspense>

      {/* Debug wireframe overlay for hitbox calibration */}
      {debugMode && <DebugHitboxes hitboxes={config.hitboxes} modelKey={modelKey} />}

      {/* RIGGED model → bone-driven muscles (auto, animation-ready).
          NON-rigged → static hand-calibrated hitboxes. */}
      {rig ? (
        <BoneMuscleLayer rig={rig} settledGroup={settledGroup} onFocus={onFocus} />
      ) : (
        config.hitboxes.map((h, i) => (
          <Hitbox
            key={`${modelKey}-${h.group}-${i}`}
            group={h.group}
            position={h.position}
            rotation={h.rotation}
            scale={h.scale}
            shape={h.shape}
            onFocus={onFocus}
          />
        ))
      )}

      {/* Calibration mode: free orbit + no auto camera. Production: P5 camera rig. */}
      {debugMode ? (
        <OrbitControls makeDefault enableDamping={false} />
      ) : (
        <CameraRig
          focusGroup={focusedGroup}
          muscleCameras={muscleCameras}
          poseFor={bonePoseFor}
          onSettled={setSettledGroup}
          play={play}
        />
      )}
    </group>
  )
}

export default function MuscleBody({ onFocus, focusedGroup, modelKey = 'goku' }) {
  const [debugMode, setDebugMode] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1'
  )
  const { play } = useSound()

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '`') setDebugMode((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: OVERVIEW_CAM.pos, fov: 45 }}
        shadows={false}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, stencil: true }}
      >
        <SceneContent
          modelKey={modelKey}
          focusedGroup={focusedGroup}
          onFocus={onFocus}
          debugMode={debugMode}
          play={play}
        />
      </Canvas>

      {/* Calibration HUD — visible when debug mode is on */}
      {debugMode && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          background: 'rgba(0,0,0,0.75)',
          border: '1px solid #ffcc00',
          color: '#ffcc00',
          fontFamily: 'monospace',
          fontSize: 11,
          padding: '6px 10px',
          borderRadius: 4,
          pointerEvents: 'none',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 2 }}>CALIBRATION MODE — {modelKey}</div>
          <div>T = translate &nbsp; S = scale &nbsp; R = rotate</div>
          <div>F12 = snapshot all hitboxes → console + JSON download</div>
          <div style={{ color: '#aaa' }}>` (backtick) to exit</div>
        </div>
      )}

      {/* Subtle indicator when debug mode is off */}
      {!debugMode && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 10,
          color: 'rgba(255,255,255,0.18)',
          fontFamily: 'monospace',
          fontSize: 10,
          pointerEvents: 'none',
        }}>
          ` = calibration mode
        </div>
      )}
    </div>
  )
}
