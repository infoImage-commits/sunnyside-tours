export interface HeroSlide {
  id: string;
  image: string;
  subtitleKey: string;
  titleKey: string;
  descriptionKey: string;
}

export const heroSlides: HeroSlide[] = [
  {
    id: "boat",
    image: "/Hero/boat.png",
    subtitleKey: "slides.boat.subtitle",
    titleKey: "slides.boat.title",
    descriptionKey: "slides.boat.description",
  },
  {
    id: "sunset",
    image: "/Hero/sunset.png",
    subtitleKey: "slides.sunset.subtitle",
    titleKey: "slides.sunset.title",
    descriptionKey: "slides.sunset.description",
  },
  {
    id: "prim",
    image: "/Hero/prim.png",
    subtitleKey: "slides.prim.subtitle",
    titleKey: "slides.prim.title",
    descriptionKey: "slides.prim.description",
  },
];
