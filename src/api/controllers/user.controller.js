import { UserProduct } from "../models/user.model.js";
import { userValidation } from "../validators/user.validation.js";
import { validateLogin } from "../validators/user.validation.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
const config = dotenv.config();

const salt = parseInt(process.env.SALT);

//create user
async function signup(req, res) {
    try {
        //validate before creating new user
        const { error } = userValidation(req.body);
        if (error) {
            return res.status(400).json({
                msg: error.details[0].message,
            })
        }

        let { firstname, lastname, email, password, comfirmPassword } = req.body;

        //check if account exists
        //P.S: deactivate this block of code at first use(it might throw an error). Create a user then turn on...
        const emailExists = await UserProduct.findOne({ email: email, active: true });
        if (emailExists) {
            return res.status(400).json({
                status: 'failed ',
                msg: "User already exists",
            })
        };

        //hash password
        //const salt = 12;
        password = await bcrypt.hash(password, salt);

        //create a new user account
        const user = new UserProduct({
            firstname, lastname, email, password, comfirmPassword
        });

        await user.save();
        console.log({ firstname, lastname, email });

        return res.status(201).json({
            msg: 'UserCreated successfully',
            success: 'true',
            firstname: firstname,
            lastname: lastname,
            email: email,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            status: "failed",
            msg: "Unable to create User",
            err
        });
    }
}

//read all user
const readUser = async (req, res) => {
    try {
        const users = await UserProduct.find({ active: true });
        if (users.length === 0) {
            return res.status(200).json({
                success: "true",
                msg: "no user created"
            })
        }
        res.status(200).json(users);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            status: "failed",
            msg: "Unable to get all User",
            err
        });;
    }

}

//read one user by id
const readOneUser = async (req, res) => {
    try {
        const user = await UserProduct.findOne({ _id: req.params.id, active: true });
        if (!user) {
            return res.status(200).json({
                success: "true",
                msg: "User does not exist"
            })
        }
        res.status(200).json(user);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            status: "failed",
            msg: "Unable to get User",
            err
        });;
    }
}

//update a user info
const updateUserInfo = async (req, res) => {
    try {
        const user = await UserProduct.findOne({ _id: req.params.id, active: true });
        if (!user) {
            return res.status(200).json({
                success: "true",
                msg: "User does not exist"
            })
        }
        user.firstname = req.body.firstname;
        user.lastname = req.body.lastname;
        await user.save();

        res.status(200).json({
            msg: "User info updated",
            user,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            status: "failed",
            msg: "Unable to update User Info",
            err
        });
    }
}

//update a user password
const updateUserPassword = async (req, res) => {
    try {
        const user = await UserProduct.findOne({ _id: req.params.id, active: true });
        if (!user) {
            return res.status(200).json({
                success: "true",
                msg: "User does not exist"
            })
        }

        if (req.body.password !== req.body.confirmPassword) {
            return res.status(200).json({
                success: false,
                msg: "Incorrect Password"
            });
        }
        const password = req.body.password;
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        res.status(200).json({
            msg: "User Password updated",
            user,
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            status: "failed",
            msg: "Unable to update User Password",
            err
        });
    }
}


//soft delete user
const deleteUser = async (req, res) => {
    try {
        const user = await UserProduct.findOne({ _id: req.params.id, active: true });
        if (!user) {
            return res.status(200).json({
                success: "true",
                msg: "User does not exist"
            })
        }
        user.active = false;
        await user.save();

        res.status(200).json({
            msg: "User soft deleted",
            user,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            status: "failed",
            msg: "Unable to delete User",
            err
        });
    }
}

//sign in a user
const loginUser = async (req, res) => {
    try {
        const { error } = validateLogin(req.body);
        if (error) {
            console.log(error);
            return res.status(401).json({
                status: "failed",
                msg: "incorrect details",
                error
            })
        };
        const { email, password } = req.body;
        const user = await UserProduct.findOne({ email }).select('+password');

        //compare password with hash password
        const validUser = await bcrypt.compare(password, user.password);

        if (!validUser || !user) {
            return res.status(400).json({
                status: true,
                msg: "Incorrect details, access denied",
            })
        }

        //issue an access token
        const accessToken = jwt.sign(
            { id: user._id },
            process.env.ACCESS_JWT_TOKEN,
            { expiresIn: '30m' }); //expires in 30mins

        //issue a refresh token
        const refreshToken = jwt.sign(
            { id: user._id },
            process.env.REFRESH_JWT_TOKEN,
            { expiresIn: '1d' });

        //store refresh token in user
        user.refreshToken = refreshToken;
        user.save();

        //send refresh token to cookies as httpOnly
        res.cookie('jwt', refreshToken, {
            httpOnly: true,
            // secure: true,  //turn on in production
            // sameSite: 'None',
            maxAge: 24 * 60 * 60 * 1000, //a day in milliseconds
        });

        res.status(200).json({
            success: true,
            msg: "Login successfull",
            accessToken
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: "failed",
            msg: "Unable to login",
            error
        });
    }
}

//logout User
const logoutUser = async (req, res) => {
    try {
        res
            .status(200)
            .clearCookie('jwt')
            .json({
                success: true,
                msg: "logout successful"
            })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: "failed",
            msg: "Unable to logout",
            error
        });
    }
}

//refresh token
const tokenRefresh = async (req, res) => {
    try {
        const cookie = req.cookies;
        //console.log(cookie);
        if (!cookie?.jwt) {
            return res.status(401).json({
                success: 'failed',
                msg: 'Access denied, Sign In'
            })
        }

        const refreshToken = cookie.jwt;

        const user = await UserProduct.findOne({ refreshToken });
        if (!user) {
            return res.status(400).json({
                status: "failed",
                msg: "Access denied, Sign In",
            })
        }

        //evaluate access token
        jwt.verify(
            refreshToken,
            process.env.REFRESH_JWT_TOKEN,
            (err, decoded) => {
                if (err || user._id != decoded.id) {
                    return res.status(403).json({
                        status: false,
                        msg: 'Forbidden',
                    })
                }

                //issue access token
                const accessToken = jwt.sign(
                    { id: user._id },
                    process.env.ACCESS_JWT_TOKEN,
                    { expiresIn: '15s' }); //15 mins

                return res.status(200).json({
                    accessToken
                })
            });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            status: "failed",
            msg: "Unable to login",
            err
        });
    }
}

export default {
    signup,
    readUser,
    readOneUser,
    updateUserInfo,
    updateUserPassword,
    deleteUser,
    loginUser,
    logoutUser,
    tokenRefresh
}


//cookies in res is written in singular e.g "cookie", "clearCookie"
//cookies in req is written in plural e.g "cookies"
