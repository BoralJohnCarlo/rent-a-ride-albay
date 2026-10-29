import { useParams } from "react-router-dom";

import DriverProfileContent from "../../components/driver/DriverProfileContent";
import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

const DriverProfile = () => {
    const { driverId } = useParams();

    return (
        <PageContainer>
            <Section
                spacing="MD"
                className="mx-auto w-full max-w-3xl"
            >
                <DriverProfileContent driverId={driverId} />
            </Section>
        </PageContainer>
    );
};

export default DriverProfile;
