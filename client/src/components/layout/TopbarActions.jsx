import NavbarActions from "./NavbarActions";

const TopbarActions = ({ user, onLogout }) => {
    return (
        <NavbarActions
            user={user}
            onLogout={onLogout}
            notificationPath="/admin/notifications"
        />
    );
};

export default TopbarActions;