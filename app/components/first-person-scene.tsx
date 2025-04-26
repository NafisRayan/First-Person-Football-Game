"use client"

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Vector3, RepeatWrapping } from "three"
import { Geometry } from "three-stdlib";
import { PointerLockControls, Plane, useTexture, useGLTF, Environment } from "@react-three/drei"
import { Physics, usePlane, useSphere, useBox, useConvexPolyhedron } from "@react-three/cannon"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const TEXTURES = {
  ground: {
    colorMap: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Snow007A_1K-JPG_Color-fqUbdtaLLo50sIQcICJwHUWJGdgjyI.jpg",
    displacementMap: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Snow007A_1K-JPG_Displacement-w54QlVObPwnSh9THsIJMigUmExq1G7.jpg",
    normalMap: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Snow007A_1K-JPG_NormalGL-WnjEjuR897euo20HyItfUbgxRaR5Sl.jpg",
    roughnessMap: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Snow007A_1K-JPG_Roughness-N0xEA5cs65MfGnR8ictjHVuObjCcgs.jpg",
    aoMap: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Snow007A_1K-JPG_AmbientOcclusion-oOddkNLnaJt3y0QWhUrECeBIYwmLpe.jpg"
  },
  pyramid: {
    colorMap: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Metal059A_1K-JPG_Color-XUu2Dw1uKGN79qnoc3G5m0PY5tU66z.jpg",
    normalMap: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Metal059A_1K-JPG_NormalGL-zKHdKHRuj0iniXLJKIQDUoNnqMQEcR.jpg",
    roughnessMap: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Metal059A_1K-JPG_Roughness-RuuaMWe9IMTSJt6iGNxLHh7CSDBI9J.jpg",
    metalnessMap: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Metal059A_1K-JPG_Metalness-cBRVhYO2sgUdMfwxDIdvoL9vDRvpb4.jpg",
  }
}

const MODELS = {
  soccerBall: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/soccer_ball%20(3)-WwKpUbAGistdeknz1f7rcJhlRYUIU4.glb",
  tree: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pine_tree-mPDmm88a3gyV8fuOVRSp4MmGUONz5S.glb",
  glassPyramid: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/glass_pyramid-zzCVvcenxkndCLz5YJecNtYvOCNg5g.glb",
}

const SOUNDS = {
  ballHit: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/mixkit-hitting-soccer-ball-2112-WDrmmZYGqLD4m3DbdnjqvlFdSUbthv.wav"
}

const usePlayerControls = () => {
  const keys = useRef({ forward: false, backward: false, left: false, right: false, jump: false, shift: false });

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW': keys.current.forward = true; break;
        case 'KeyS': keys.current.backward = true; break;
        case 'KeyA': keys.current.left = true; break;
        case 'KeyD': keys.current.right = true; break;
        case 'Space': keys.current.jump = true; break;
        case 'ShiftLeft': case 'ShiftRight': keys.current.shift = true; break;
      }
    };
    const handleKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': keys.current.forward = false; break;
        case 'KeyS': keys.current.backward = false; break;
        case 'KeyA': keys.current.left = false; break;
        case 'KeyD': keys.current.right = false; break;
        case 'Space': keys.current.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': keys.current.shift = false; break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return keys;
};

function Player({ position = [0, 10, 0] }) {
  const direction = new Vector3();
  const frontVector = new Vector3();
  const sideVector = new Vector3();
  const WALK_SPEED = 15;
  const RUN_SPEED = 25;
  const JUMP_FORCE = 25;
  const PLAYER_HEIGHT = 1.8;
  const SPHERE_RADIUS = 0.3;
  const INITIAL_CAMERA_TILT = 0.15;

  const { camera } = useThree();

  const [ref, api] = useSphere(() => ({
    mass: 1,
    type: 'Dynamic',
    position,
    args: [SPHERE_RADIUS],
    linearDamping: 0.1,
    fixedRotation: true,
  }));

  const playerControls = usePlayerControls();
  const velocity = useRef([0, 0, 0]);
  const isGrounded = useRef(false);

  useEffect(() => {
    api.velocity.subscribe((v) => (velocity.current = v));
    api.position.subscribe((p) => {
      camera.position.set(p[0], p[1] + PLAYER_HEIGHT - SPHERE_RADIUS, p[2]);
    });

    camera.rotation.x = INITIAL_CAMERA_TILT;
  }, [api.velocity, api.position, camera]);

  useFrame((state) => {
    frontVector.set(0, 0, Number(playerControls.current.backward) - Number(playerControls.current.forward));
    sideVector.set(Number(playerControls.current.left) - Number(playerControls.current.right), 0, 0);
    direction.subVectors(frontVector, sideVector).normalize().multiplyScalar(playerControls.current.shift ? RUN_SPEED : WALK_SPEED).applyEuler(camera.rotation);

    api.velocity.set(direction.x, velocity.current[1], direction.z);

    isGrounded.current = Math.abs(velocity.current[1]) < 0.1;

    if (playerControls.current.jump && isGrounded.current) {
      api.velocity.set(velocity.current[0], JUMP_FORCE, velocity.current[2]);
    }

    if (!isGrounded.current) {
      api.applyForce([0, -9.8 * 3, 0], [0, 0, 0]);
    }
  });

  return <mesh ref={ref} castShadow receiveShadow />;
}

function Ground() {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    friction: 0.5,
    restitution: 0,
  }))

  const textures = useTexture(TEXTURES.ground, (textures) => {
    Object.values(textures).forEach(texture => {
      texture.wrapS = texture.wrapT = RepeatWrapping
      texture.repeat.set(3000, 3000)
    })
  })

  return (
    <Plane ref={ref} args={[10000, 10000]} receiveShadow>
      <meshStandardMaterial
        map={textures.colorMap}
        displacementMap={textures.displacementMap}
        normalMap={textures.normalMap}
        roughnessMap={textures.roughnessMap}
        aoMap={textures.aoMap}
        displacementScale={0.2}
        roughness={1}
        metalness={0}
      />
    </Plane>
  )
}

const SoccerBall = React.memo(() => {
  const { scene } = useGLTF(MODELS.soccerBall)
  const [ref, api] = useSphere(() => ({
    mass: 0.2,
    position: [0, 0.6, -5],
    args: [0.6],
    friction: 0.1,
    restitution: 0.8,
    linearDamping: 0.1,
    angularDamping: 0.1,
    onCollide: handleCollision,
  }))

  const sound = useRef(new Audio(SOUNDS.ballHit))
  const lastCollisionTime = useRef(0)
  const hasInteracted = useRef(false)

  useEffect(() => {
    const handleInteraction = () => {
      hasInteracted.current = true
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }

    window.addEventListener('click', handleInteraction)
    window.addEventListener('keydown', handleInteraction)

    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
  }, [scene])

  function handleCollision() {
    const currentTime = Date.now()
    if (hasInteracted.current && currentTime - lastCollisionTime.current > 100) {
      sound.current.currentTime = 0
      sound.current.play()
      lastCollisionTime.current = currentTime
    }
  }

  useFrame(() => {
    api.position.subscribe((position) => {
      if (position[1] < -100) {
        api.position.set(0, 10, -5)
        api.velocity.set(0, 0, 0)
      }
    })
  })

  return <primitive ref={ref} object={scene.clone()} scale={[0.6, 0.6, 0.6]} />
})

SoccerBall.displayName = 'SoccerBall'

function Tree({ position }) {
  const { scene } = useGLTF(MODELS.tree)
  const [ref] = useBox(() => ({
    mass: 0,
    position: position,
    args: [0.5, 2, 0.5],
  }))

  const scale = useMemo(() => 0.05 + Math.random() * 0.02, [])

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        const material = child.material
        material.roughness = 0.8
        material.metalness = 0.1
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [scene])

  return <primitive ref={ref} object={scene.clone()} position={position} scale={[scale, scale, scale]} />
}

function Forest() {
  const treePositions = useMemo(() => {
    const positions = [];
    const restrictedAreas = [
      { center: [0, 0, -80], radius: 100 },
      { center: [0, 0, -5], radius: 10 },
      { center: [0, 0, 0], radius: 20 },
    ];

    const isPositionValid = (pos) => {
      for (const area of restrictedAreas) {
        const distance = Math.sqrt(
          Math.pow(pos[0] - area.center[0], 2) +
          Math.pow(pos[2] - area.center[2], 2)
        );
        if (distance < area.radius) {
          return false;
        }
      }
      return true;
    };

    const fixedPositions = [
      [-80, 0, -80], [80, 0, -80], [-80, 0, 80], [80, 0, 80],
      [0, 0, -120], [-120, 0, 0], [120, 0, 0], [0, 0, 120],
    ];

    for (const pos of fixedPositions) {
      if (isPositionValid(pos)) {
        positions.push(pos);
      }
    }

    while (positions.length < 108) {
      const pos = [(Math.random() - 0.5) * 400, 0, (Math.random() - 0.5) * 400];
      if (isPositionValid(pos)) {
        positions.push(pos);
      }
    }

    return positions;
  }, []);

  return (
    <>
      {treePositions.map((position, index) => (
        <Tree key={index} position={position} />
      ))}
    </>
  );
}

function scaleGeometry(geometry, scaleX, scaleY, scaleZ) {
  geometry.vertices.forEach((vertex) => {
    vertex.x *= scaleX;
    vertex.y *= scaleY;
    vertex.z *= scaleZ;
  });

  geometry.verticesNeedUpdate = true;
}

const GLASS_PYRAMID_SCALE = 80;

function toConvexProps(bufferGeometry, scale = 1) {
  const geo = new Geometry().fromBufferGeometry(bufferGeometry);
  scaleGeometry(geo, scale, scale, scale)
  geo.mergeVertices();
  return [geo.vertices.map((v) => [v.x, v.y, v.z]), geo.faces.map((f) => [f.a, f.b, f.c]), []];
}

function GlassPyramid() {
  const { nodes } = useGLTF(MODELS.glassPyramid)

  const geo = useMemo(() => toConvexProps(nodes.Object_4.geometry, GLASS_PYRAMID_SCALE), [nodes]);

  const [ref] = useConvexPolyhedron(() => ({ mass: 0, args: geo, position: [0, 0, -80] }));

  const textures = useTexture(TEXTURES.pyramid, (textures) => {
    Object.values(textures).forEach(texture => {
      texture.wrapS = texture.wrapT = RepeatWrapping
      texture.repeat.set(10, 10)
    })
  })

  return (
    <mesh
      castShadow
      receiveShadow
      ref={ref}
      geometry={nodes.Object_4.geometry}
      scale={[GLASS_PYRAMID_SCALE, GLASS_PYRAMID_SCALE, GLASS_PYRAMID_SCALE]}
    >
      <meshStandardMaterial
        map={textures.colorMap}
        normalMap={textures.normalMap}
        roughnessMap={textures.roughnessMap}
        metalnessMap={textures.metalnessMap}
        roughness={1}
        metalness={1}
      />
    </mesh>
  )
}

function Scene() {
  return (
    <Physics gravity={[0, -9.8, 0]}>
      <Environment
        files="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/M3_Drone_Shot_equirectangular-jpg_beautiful_colorful_aurora_borealis_1590129447_11909016%20(1)%20(1)-wZt8kjPRcukoLvG8o8jpg7XjTYEAMX.jpg"
        background
        blur={0}
      />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 10]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Player />
      <Ground />
      <SoccerBall />
      <Forest />
      <GlassPyramid />
    </Physics>
  )
}

const CREDITS = [
  { title: "Pine Tree", url: "https://sketchfab.com/3d-models/pine-tree-e52769d653cd4e52a4acff3041961e65" },
  { title: "Soccer Ball", url: "https://sketchfab.com/3d-models/soccer-ball-46c91864ef384158b0078e20bdbfe3e9" },
  { title: "Snow 007 A", url: "https://ambientcg.com/view?id=Snow007A" },
  { title: "Metal 059 A", url: "https://ambientcg.com/view?id=Metal059A" },
  { title: "Aurora Borealis Skybox", url: "https://skybox.blockadelabs.com/da26e850f3cd07ad2eec9d5052d69a91" },
  { title: "Glass Pyramid", url: "https://sketchfab.com/3d-models/glass-pyramid-e43d6bbed7434567b4e00efbb0037f9f" },
  { title: "Hitting Soccer Ball", url: "https://mixkit.co/free-sound-effects/ball" }
]

function CreditsDialog({ isOpen, onOpenChange }) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-4">Credits</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-6">
          {CREDITS.map((credit, index) => (
            <div key={index}>
              <h3 className="text-lg font-semibold mb-1">{credit.title}</h3>
              <p className="text-sm text-gray-300 break-all">{credit.url}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function BasicFirstPersonControls() {
  const [isCreditsOpen, setIsCreditsOpen] = useState(false)

  const handleCreditsClick = () => {
    setIsCreditsOpen(true)
  }

  return (
    <div className="w-full h-screen">
      <Canvas id="canvas" shadows camera={{ fov: 75, near: 0.1, far: 1000 }}>
        <Scene />
        <PointerLockControls selector="#canvas" />
      </Canvas>
      {/* <div className="fixed bottom-4 right-4 z-10">
        <Button
          variant="outline"
          className="bg-black text-white hover:bg-gray-800 hover:text-white transition-all duration-200 border-0"
          onClick={handleCreditsClick}
        >
          Credits
        </Button>
      </div> */}
      <CreditsDialog
        isOpen={isCreditsOpen}
        onOpenChange={(open) => setIsCreditsOpen(open)}
      />
    </div>
  )
}
