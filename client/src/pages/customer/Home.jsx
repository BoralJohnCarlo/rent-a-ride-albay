import HeroSection from "../../components/sections/HeroSection";
import FeaturedVehiclesSection from "../../components/sections/FeaturedVehiclesSection";
import VehicleCategoriesSection from "../../components/sections/VehicleCategoriesSection";
import WhyChooseUsSection from "../../components/sections/WhyChooseUsSection";
import RentalProcessSection from "../../components/sections/RentalProcessSection";
import TestimonialsSection from "../../components/sections/TestimonialsSection";
import FAQSection from "../../components/sections/FAQSection";
import CTASection from "../../components/sections/CTASection";

const Home = () => {
    return (
        <>
            <HeroSection />

            <FeaturedVehiclesSection />

            <VehicleCategoriesSection />

            <WhyChooseUsSection />

            <RentalProcessSection />

            <TestimonialsSection />

            <FAQSection />

            <CTASection />
        </>
    );
};

export default Home;